import { EventEmitter, EventMap } from "./common";

export const BLE_SERVICE_UUID = "b500";
export const BLE_CHARACTERISTIC_UUID = "b501";

export type BleTransportEvents = {
    connected: () => void;
    disconnected: (event?: unknown) => void;
    data: (data: Buffer) => void;
} & EventMap;

/**
 * Platform-specific BLE backend. {@link BleConnection} stays identical across
 * macOS/Windows (noble) and Linux (node-ble).
 */
export abstract class BleTransport extends EventEmitter<BleTransportEvents> {
    /** Local names observed while scanning for the target device. */
    abstract readonly scannedDeviceNames: readonly string[];

    abstract connect(deviceName: string): Promise<void>;
    abstract abortConnect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract write(data: Buffer): Promise<void>;
    /** True when a GATT characteristic is ready for reads/writes. */
    abstract isReady(): boolean;

    buildUnauthorizedError(): Error {
        return new Error(
            `Bluetooth adapter is unauthorized.\n\n` +
            `Please check Bluetooth permissions and that Bluetooth is enabled, then retry.`,
        );
    }
}

export function createBleTransport(): BleTransport {
    if (process.platform === "linux") {
        // Lazy-load so macOS/Windows never pull in the BlueZ/D-Bus stack.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NodeBleTransport } = require("./ble-node-ble") as typeof import("./ble-node-ble");
        return new NodeBleTransport();
    }
    // Lazy-load so Linux never initializes noble's HCI binding.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NobleBleTransport } = require("./ble-noble") as typeof import("./ble-noble");
    return new NobleBleTransport();
}

/** Normalize short (16/32-bit) and 128-bit BLE UUIDs for comparison. */
export function normalizeBleUuid(uuid: string): string {
    const hex = uuid.replace(/-/g, "").toLowerCase();
    if (hex.length === 4) {
        return `0000${hex}-0000-1000-8000-00805f9b34fb`;
    }
    if (hex.length === 8) {
        return `${hex}-0000-1000-8000-00805f9b34fb`;
    }
    if (hex.length === 32) {
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return uuid.toLowerCase();
}

export function bleUuidsEqual(a: string, b: string): boolean {
    return normalizeBleUuid(a) === normalizeBleUuid(b);
}

// BlueZ falls back to the address with `:` replaced by `-` when a device has no name.
const MAC_ADDRESS_RE = /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i;

/** True when `name` looks like a Bluetooth device address rather than a local name. */
export function isBluetoothAddress(name: string): boolean {
    return MAC_ADDRESS_RE.test(name);
}
