import nodeBle from "node-ble";
import {
    BLE_CHARACTERISTIC_UUID,
    BLE_SERVICE_UUID,
    BleTransport,
    bleUuidsEqual,
    isBluetoothAddress,
} from "./ble-transport";

type Adapter = nodeBle.Adapter;
type Device = nodeBle.Device;
type GattCharacteristic = nodeBle.GattCharacteristic;

const { createBluetooth } = nodeBle;
const DISCOVERY_POLL_MS = 250;

/**
 * BLE transport backed by node-ble / BlueZ D-Bus (Linux only).
 */
export class NodeBleTransport extends BleTransport {
    private destroySession: (() => void) | null = null;
    private adapter: Adapter | null = null;
    private device: Device | null = null;
    private characteristic: GattCharacteristic | null = null;
    private cancelled = false;
    private _scannedDeviceNames: string[] = [];
    private onValueChanged: ((data: Buffer) => void) | null = null;
    private onDeviceDisconnect: (() => void) | null = null;

    get scannedDeviceNames(): readonly string[] {
        return this._scannedDeviceNames;
    }

    async connect(deviceName: string): Promise<void> {
        this.cancelled = false;
        this._scannedDeviceNames = [];

        try {
            const { bluetooth, destroy } = createBluetooth();
            this.destroySession = destroy;
            this.adapter = await bluetooth.defaultAdapter();
        } catch (error) {
            throw this.mapPermissionError(error);
        }

        if (!(await this.adapter.isPowered())) {
            throw new Error("Bluetooth adapter is powered off. Please enable Bluetooth and retry.");
        }

        try {
            if (!(await this.adapter.isDiscovering())) {
                await this.adapter.startDiscovery();
            }
        } catch (error) {
            throw this.mapPermissionError(error);
        }

        const device = await this.findDeviceByName(deviceName);
        if (this.cancelled) {
            throw new Error("BLE connect aborted.");
        }

        try {
            await this.adapter.stopDiscovery();
        } catch {
            // ignore if discovery already stopped
        }

        this.device = device;
        this.onDeviceDisconnect = () => {
            this.characteristic = null;
            this.device = null;
            this.emit("disconnected", { connected: false });
        };
        this.device.on("disconnect", this.onDeviceDisconnect);

        await this.device.connect();
        this.emit("connected");

        const gatt = await this.device.gatt();
        const serviceUuid = await this.findUuid(await gatt.services(), BLE_SERVICE_UUID);
        if (!serviceUuid) {
            throw new Error(`Target service ${BLE_SERVICE_UUID} not found.`);
        }
        const service = await gatt.getPrimaryService(serviceUuid);
        const characteristicUuid = await this.findUuid(
            await service.characteristics(),
            BLE_CHARACTERISTIC_UUID,
        );
        if (!characteristicUuid) {
            throw new Error(`Target characteristic ${BLE_CHARACTERISTIC_UUID} not found.`);
        }
        this.characteristic = await service.getCharacteristic(characteristicUuid);

        this.onValueChanged = (data: Buffer) => {
            this.emit("data", data);
        };
        this.characteristic.on("valuechanged", this.onValueChanged);
        await this.characteristic.startNotifications();
    }

    async abortConnect(): Promise<void> {
        this.cancelled = true;
        if (this.adapter) {
            try {
                if (await this.adapter.isDiscovering()) {
                    await this.adapter.stopDiscovery();
                }
            } catch {
                // ignore
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.characteristic) {
            try {
                if (this.onValueChanged) {
                    this.characteristic.off("valuechanged", this.onValueChanged);
                    this.onValueChanged = null;
                }
                await this.characteristic.stopNotifications();
            } catch {
                // ignore if already stopped / disconnected
            }
            this.characteristic = null;
        }
        if (this.device) {
            // Detach first so node-ble's internal cleanup does not double-fire.
            if (this.onDeviceDisconnect) {
                this.device.off("disconnect", this.onDeviceDisconnect);
                this.onDeviceDisconnect = null;
            }
            try {
                await this.device.disconnect();
            } catch {
                // ignore
            }
            this.device = null;
            // node-ble may not emit disconnect after removeListeners(); mirror noble.
            this.emit("disconnected", { connected: false });
        }
        this.adapter = null;
        if (this.destroySession) {
            this.destroySession();
            this.destroySession = null;
        }
    }

    async write(data: Buffer): Promise<void> {
        if (!this.characteristic) {
            throw new Error("BLE characteristic is not available.");
        }
        await this.characteristic.writeValueWithResponse(data);
    }

    isReady(): boolean {
        return this.characteristic != null && this.device != null;
    }

    buildUnauthorizedError(): Error {
        return new Error(
            `Bluetooth / D-Bus access was denied.\n\n` +
            `On Linux, BlueScript uses node-ble (BlueZ over D-Bus). Grant access with:\n` +
            `  bscript board setup esp32\n\n` +
            `Or install the D-Bus policy manually (replace USER with your username):\n` +
            `  See node-ble docs: https://github.com/chrvadala/node-ble#provide-permissions\n` +
            `  Policy file: /etc/dbus-1/system.d/node-ble.conf\n\n` +
            `Also ensure BlueZ is installed and Bluetooth is enabled.`,
        );
    }

    private async findDeviceByName(deviceName: string): Promise<Device> {
        if (!this.adapter) {
            throw new Error("Bluetooth adapter is not initialized.");
        }

        while (!this.cancelled) {
            let addresses: string[];
            try {
                addresses = await this.adapter.devices();
            } catch (error) {
                throw this.mapPermissionError(error);
            }

            for (const address of addresses) {
                try {
                    const device = await this.adapter.getDevice(address);
                    const name = await this.resolveDeviceName(device);
                    if (!name) {
                        continue;
                    }
                    if (!this._scannedDeviceNames.includes(name)) {
                        this._scannedDeviceNames.push(name);
                    }
                    if (name === deviceName) {
                        return device;
                    }
                } catch {
                    // Device may disappear or props may be temporarily unavailable.
                }
            }

            await sleep(DISCOVERY_POLL_MS);
        }

        throw new Error("BLE connect aborted.");
    }

    private async resolveDeviceName(device: Device): Promise<string | null> {
        try {
            const name = await device.getName();
            if (name) {
                return name;
            }
        } catch {
            // Name property is often unset until advertising data arrives.
        }
        try {
            const alias = await device.getAlias();
            // BlueZ defaults Alias to the MAC address when no name is known yet.
            if (alias && !isBluetoothAddress(alias)) {
                return alias;
            }
        } catch {
            // ignore
        }
        return null;
    }

    private async findUuid(uuids: string[], target: string): Promise<string | undefined> {
        return uuids.find((uuid) => bleUuidsEqual(uuid, target));
    }

    private mapPermissionError(error: unknown): Error {
        const message = error instanceof Error ? error.message : String(error);
        if (
            /access denied|permission|unauthorized|not allowed|rejected/i.test(message)
            || message.includes("org.freedesktop.DBus.Error.AccessDenied")
        ) {
            return this.buildUnauthorizedError();
        }
        if (error instanceof Error) {
            return error;
        }
        return new Error(message);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
