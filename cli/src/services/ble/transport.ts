import { EventEmitter, EventMap } from "../common";

export const BLE_SERVICE_UUID = "b500";
export const BLE_CHARACTERISTIC_UUID = "b501";

export type BleTransportEvents = {
    connected: () => void;
    disconnected: (event?: unknown) => void;
    data: (data: Buffer) => void;
} & EventMap;

/**
 * Platform-specific BLE backend. {@link BleConnection} stays identical across
 * macOS (noble), Windows (webbluetooth), and Linux (node-ble).
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
        const { NodeBleTransport } = require("./node-ble-transport");
        return new NodeBleTransport();
    }
    if (process.platform === "darwin") {
        // Lazy-load so Linux/Windows never initialize noble's bindings.
        // noble is an optionalDependency so Windows installs can succeed without it.
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { NobleBleTransport } = require("./noble-transport");
            return new NobleBleTransport();
        } catch (error) {
            throw mapOptionalNobleLoadError(error);
        }
    }
    // Windows (and any other non-Linux/non-macOS): webbluetooth / SimpleBLE.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebBluetoothTransport } = require("./webbluetooth-transport");
    return new WebBluetoothTransport();
}

function mapOptionalNobleLoadError(error: unknown): Error {
    const code = (error as NodeJS.ErrnoException | null | undefined)?.code;
    const message = error instanceof Error ? error.message : String(error);
    if (
        code === "MODULE_NOT_FOUND" ||
        /Cannot find module ['"]@abandonware\/noble['"]/.test(message)
    ) {
        return new Error(
            `Bluetooth support on macOS requires @abandonware/noble, but it is not installed.\n\n` +
            `On macOS, reinstall the CLI (or run \`npm install\` in the repo) and ensure ` +
            `install scripts are allowed for @abandonware/noble.`,
            { cause: error },
        );
    }
    if (error instanceof Error) {
        return error;
    }
    return new Error(message);
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
