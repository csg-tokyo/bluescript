import nodeBle from "node-ble";
import {
    BLE_CHARACTERISTIC_UUID,
    BLE_SERVICE_UUID,
    BleTransport,
    bleUuidsEqual,
    isBluetoothAddress,
} from "./transport";

type Adapter = nodeBle.Adapter;
type Device = nodeBle.Device;
type GattCharacteristic = nodeBle.GattCharacteristic;

const { createBluetooth } = nodeBle;
const DISCOVERY_POLL_MS = 250;
/** D-Bus calls have no timeout of their own, so cleanup must not block forever. */
const TEARDOWN_TIMEOUT_MS = 2000;

const PERMISSION_DENIED_DBUS_ERRORS = new Set([
    "org.freedesktop.DBus.Error.AccessDenied",
    "org.freedesktop.DBus.Error.AuthFailed",
    "org.bluez.Error.NotAuthorized",
]);

/** The D-Bus connection and the adapter it owns; both die together. */
type BluezSession = {
    readonly adapter: Adapter;
    readonly destroy: () => void;
};

/** A subscribed characteristic paired with the listener we attached to it. */
type GattSubscription = {
    readonly characteristic: GattCharacteristic;
    readonly onValueChanged: (data: Buffer) => void;
};

/** A connected device paired with the listener we attached to it. */
type DeviceLink = {
    readonly device: Device;
    readonly onDisconnect: () => void;
    /** Set once the GATT characteristic has been resolved and subscribed. */
    subscription: GattSubscription | null;
};

/**
 * BLE transport backed by node-ble / BlueZ D-Bus (Linux only).
 */
export class NodeBleTransport extends BleTransport {
    private session: BluezSession | null = null;
    private link: DeviceLink | null = null;
    private abortController: AbortController | null = null;
    private _scannedDeviceNames: string[] = [];

    get scannedDeviceNames(): readonly string[] {
        return this._scannedDeviceNames;
    }

    async connect(deviceName: string): Promise<void> {
        this._scannedDeviceNames = [];
        const controller = new AbortController();
        this.abortController = controller;

        const session = await this.openSession();
        const device = await this.discoverDevice(session, deviceName, controller.signal);
        await this.establishLink(device, controller.signal);
    }

    async abortConnect(): Promise<void> {
        this.abortController?.abort(new Error("BLE connect aborted."));
        // The connect sequence cannot be interrupted between checkpoints, so
        // release the link and D-Bus session here as well.
        await this.teardown(false);
    }

    async disconnect(): Promise<void> {
        await this.teardown(true);
    }

    async write(data: Buffer): Promise<void> {
        const subscription = this.link?.subscription;
        if (!subscription) {
            throw new Error("BLE characteristic is not available.");
        }
        await subscription.characteristic.writeValueWithResponse(data);
    }

    isReady(): boolean {
        return this.link?.subscription != null;
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

    private async openSession(): Promise<BluezSession> {
        const session = await this.createSession();
        // Publish before the checks below so any later failure is torn down.
        this.session = session;

        if (!(await session.adapter.isPowered())) {
            throw new Error("Bluetooth adapter is powered off. Please enable Bluetooth and retry.");
        }
        return session;
    }

    private async createSession(): Promise<BluezSession> {
        let destroy: (() => void) | undefined;
        try {
            const handle = createBluetooth();
            destroy = handle.destroy;
            return { adapter: await handle.bluetooth.defaultAdapter(), destroy };
        } catch (error) {
            // Nothing owns the session yet, so close it here.
            destroy?.();
            throw this.mapPermissionError(error);
        }
    }

    /** Poll BlueZ's device tree until a device reports the expected name. */
    private async discoverDevice(
        session: BluezSession,
        deviceName: string,
        signal: AbortSignal,
    ): Promise<Device> {
        await this.startDiscovery(session);
        // node-ble builds a new Device per lookup, each registering another D-Bus
        // property listener, so instances have to be reused across polls.
        const seen = new Map<string, Device>();
        try {
            for (;;) {
                signal.throwIfAborted();
                const device = await this.scanOnce(session, deviceName, seen);
                if (device) {
                    return device;
                }
                await sleep(DISCOVERY_POLL_MS, signal);
            }
        } finally {
            await this.stopDiscovery(session);
        }
    }

    /** Inspect every device BlueZ currently knows about once. */
    private async scanOnce(
        session: BluezSession,
        deviceName: string,
        seen: Map<string, Device>,
    ): Promise<Device | null> {
        let addresses: string[];
        try {
            addresses = await session.adapter.devices();
        } catch (error) {
            throw this.mapPermissionError(error);
        }

        for (const address of addresses) {
            try {
                let device = seen.get(address);
                if (!device) {
                    device = await session.adapter.getDevice(address);
                    seen.set(address, device);
                }
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
                // The device may vanish or its properties may be unavailable.
                seen.delete(address);
            }
        }
        return null;
    }

    /** Connect, resolve the BlueScript characteristic and subscribe to notifications. */
    private async establishLink(device: Device, signal: AbortSignal): Promise<void> {
        const onDisconnect = () => {
            device.off("disconnect", onDisconnect);
            this.link = null;
            this.emit("disconnected");
        };
        const link: DeviceLink = { device, onDisconnect, subscription: null };
        device.on("disconnect", onDisconnect);
        this.link = link;

        await device.connect();
        signal.throwIfAborted();
        this.emit("connected");

        const characteristic = await this.resolveCharacteristic(device);
        signal.throwIfAborted();

        const onValueChanged = (data: Buffer) => this.emit("data", data);
        characteristic.on("valuechanged", onValueChanged);
        link.subscription = { characteristic, onValueChanged };
        await characteristic.startNotifications();

        if (signal.aborted) {
            // Aborted while subscribing: release the link we just established.
            await this.teardown(false);
            signal.throwIfAborted();
        }
    }

    private async resolveCharacteristic(device: Device): Promise<GattCharacteristic> {
        const gatt = await device.gatt();
        const serviceUuid = findUuid(await gatt.services(), BLE_SERVICE_UUID);
        if (!serviceUuid) {
            throw new Error(`Target service ${BLE_SERVICE_UUID} not found.`);
        }
        const service = await gatt.getPrimaryService(serviceUuid);
        const characteristicUuid = findUuid(await service.characteristics(), BLE_CHARACTERISTIC_UUID);
        if (!characteristicUuid) {
            throw new Error(`Target characteristic ${BLE_CHARACTERISTIC_UUID} not found.`);
        }
        return service.getCharacteristic(characteristicUuid);
    }

    /** Release the link, listeners and D-Bus session. Safe to call repeatedly. */
    private async teardown(emitDisconnected: boolean): Promise<void> {
        const link = this.link;
        const session = this.session;
        this.link = null;
        this.session = null;

        if (link) {
            // Detach first so node-ble's own cleanup does not re-fire.
            link.device.off("disconnect", link.onDisconnect);
            const subscription = link.subscription;
            if (subscription) {
                subscription.characteristic.off("valuechanged", subscription.onValueChanged);
                await cleanupStep(subscription.characteristic.stopNotifications());
            }
            await cleanupStep(link.device.disconnect());
        }

        session?.destroy();

        if (link && emitDisconnected) {
            // node-ble does not emit disconnect once its listeners are removed.
            this.emit("disconnected");
        }
    }

    private async startDiscovery(session: BluezSession): Promise<void> {
        try {
            if (!(await session.adapter.isDiscovering())) {
                await session.adapter.startDiscovery();
            }
        } catch (error) {
            throw this.mapPermissionError(error);
        }
    }

    private async stopDiscovery(session: BluezSession): Promise<void> {
        try {
            if (await session.adapter.isDiscovering()) {
                await session.adapter.stopDiscovery();
            }
        } catch {
            // Discovery may already be stopped, or the session may be gone.
        }
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
            // BlueZ derives Alias from the address when no name is known yet.
            if (alias && !isBluetoothAddress(alias)) {
                return alias;
            }
        } catch {
            // ignore
        }
        return null;
    }

    private mapPermissionError(error: unknown): Error {
        if (isPermissionDenied(error)) {
            return this.buildUnauthorizedError();
        }
        if (error instanceof Error) {
            return error;
        }
        return new Error(String(error));
    }
}

function findUuid(uuids: string[], target: string): string | undefined {
    return uuids.find((uuid) => bleUuidsEqual(uuid, target));
}

/** dbus-next reports the D-Bus error name via `type`, which is far more precise than the message. */
function isPermissionDenied(error: unknown): boolean {
    const dbusErrorType = (error as { type?: unknown } | null | undefined)?.type;
    if (typeof dbusErrorType === "string" && PERMISSION_DENIED_DBUS_ERRORS.has(dbusErrorType)) {
        return true;
    }
    // Session setup can fail before any D-Bus call, without a typed error.
    const message = error instanceof Error ? error.message : String(error);
    return /org\.freedesktop\.DBus\.Error\.(AccessDenied|AuthFailed)|EACCES/.test(message);
}

/** Await a cleanup step under a deadline, tolerating both failures and hangs. */
async function cleanupStep(promise: Promise<unknown>): Promise<void> {
    try {
        await withTimeout(promise, TEARDOWN_TIMEOUT_MS);
    } catch {
        // Best-effort: the link may already be gone.
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const handle = setTimeout(() => reject(new Error("BLE operation timed out.")), ms);
        promise.then(
            (value) => {
                clearTimeout(handle);
                resolve(value);
            },
            (error) => {
                clearTimeout(handle);
                reject(error);
            },
        );
    });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        let timer: NodeJS.Timeout | undefined;
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}
