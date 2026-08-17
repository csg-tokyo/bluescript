import { Bluetooth } from "webbluetooth";
import {
    BLE_CHARACTERISTIC_UUID,
    BLE_SERVICE_UUID,
    BleTransport,
    normalizeBleUuid,
} from "./transport";

/** Keep above {@link BleConnection}'s default connect timeout so the outer race wins. */
const SCAN_TIME_SECONDS = 30;

type WebBtDevice = Awaited<ReturnType<InstanceType<typeof Bluetooth>["requestDevice"]>>;
type WebBtGatt = NonNullable<WebBtDevice["gatt"]>;
type WebBtCharacteristic = Awaited<
    ReturnType<Awaited<ReturnType<WebBtGatt["getPrimaryService"]>>["getCharacteristic"]>
>;

/**
 * BLE transport backed by webbluetooth / SimpleBLE (Windows).
 */
export class WebBluetoothTransport extends BleTransport {
    private bluetooth: InstanceType<typeof Bluetooth> | null = null;
    private device: WebBtDevice | null = null;
    private characteristic: WebBtCharacteristic | null = null;
    private onGattDisconnected: (() => void) | null = null;
    private onCharacteristicValueChanged: ((event: Event) => void) | null = null;
    private _scannedDeviceNames: string[] = [];
    private connectAborted = false;

    get scannedDeviceNames(): readonly string[] {
        return this._scannedDeviceNames;
    }

    async connect(deviceName: string): Promise<void> {
        this.connectAborted = false;
        this._scannedDeviceNames = [];

        const serviceUuid = normalizeBleUuid(BLE_SERVICE_UUID);
        const characteristicUuid = normalizeBleUuid(BLE_CHARACTERISTIC_UUID);

        const bluetooth = new Bluetooth({
            scanTime: SCAN_TIME_SECONDS,
            deviceFound: (device) => {
                const name = device.name ?? "";
                if (name && !this._scannedDeviceNames.includes(name)) {
                    this._scannedDeviceNames.push(name);
                }
                // Select only the BlueScript device; keep scanning otherwise so
                // nearby names accumulate for the connection-timeout message.
                return name === deviceName;
            },
        });
        this.bluetooth = bluetooth;

        if (!(await bluetooth.getAvailability())) {
            throw new Error("Bluetooth adapter is powered off. Please enable Bluetooth and retry.");
        }

        let device: WebBtDevice;
        try {
            // Service filter matches noble's startScanningAsync([BLE_SERVICE_UUID]).
            // Name matching is done in deviceFound so other advertisers are still listed.
            device = await bluetooth.requestDevice({
                filters: [{ services: [serviceUuid] }],
            });
        } catch (error) {
            throw this.mapError(error);
        }

        if (this.connectAborted) {
            throw new Error("BLE connect aborted.");
        }

        this.detachListeners();
        this.device = device;
        this.characteristic = null;

        this.onGattDisconnected = () => {
            this.detachListeners();
            this.characteristic = null;
            this.device = null;
            this.bluetooth = null;
            this.emit("disconnected");
        };
        device.addEventListener("gattserverdisconnected", this.onGattDisconnected);

        const gatt = device.gatt;
        if (!gatt) {
            throw new Error("GATT server is not available.");
        }

        try {
            await gatt.connect();
        } catch (error) {
            throw this.mapError(error);
        }

        if (this.connectAborted) {
            await this.teardown(false);
            throw new Error("BLE connect aborted.");
        }

        this.emit("connected");

        try {
            const service = await gatt.getPrimaryService(serviceUuid);
            const characteristic = await service.getCharacteristic(characteristicUuid);
            this.characteristic = characteristic;

            this.onCharacteristicValueChanged = (event: Event) => {
                console.log("FOO")
                const target = event.currentTarget as WebBtCharacteristic | null;
                const value = target?.value;
                if (!value) {
                    return;
                }
                this.emit(
                    "data",
                    Buffer.from(value.buffer, value.byteOffset, value.byteLength),
                );
            };
            characteristic.addEventListener(
                "characteristicvaluechanged",
                this.onCharacteristicValueChanged,
            );
            await characteristic.startNotifications();
        } catch (error) {
            throw this.mapError(error);
        }

        if (this.connectAborted) {
            await this.teardown(false);
            throw new Error("BLE connect aborted.");
        }
    }

    async abortConnect(): Promise<void> {
        this.connectAborted = true;
        this.bluetooth?.cancelRequest();
        await this.teardown(false);
    }

    async disconnect(): Promise<void> {
        await this.teardown(true);
    }

    async write(data: Buffer): Promise<void> {
        if (!this.characteristic) {
            throw new Error("BLE characteristic is not available.");
        }
        await this.characteristic.writeValueWithResponse(toExactArrayBuffer(data));
    }

    isReady(): boolean {
        return this.device?.gatt?.connected === true && this.characteristic != null;
    }

    buildUnauthorizedError(): Error {
        if (process.platform === "darwin") {
            return new Error(
                `Bluetooth adapter is unauthorized.\n\n` +
                `On macOS, allow Bluetooth access for the app that runs bscript:\n` +
                `  System Settings → Privacy & Security → Bluetooth\n` +
                `  → enable Terminal, iTerm2, or whichever app you use.\n\n` +
                `Also make sure Bluetooth is turned on.`,
            );
        }
        return super.buildUnauthorizedError();
    }

    /** Release listeners and the GATT link. Safe to call repeatedly. */
    private async teardown(emitDisconnected: boolean): Promise<void> {
        const device = this.device;
        const characteristic = this.characteristic;
        const hadLink = device != null;
        this.detachListeners();
        this.characteristic = null;
        this.device = null;
        this.bluetooth = null;

        if (characteristic) {
            try {
                await characteristic.stopNotifications();
            } catch {
                // Best-effort: the link may already be gone.
            }
        }
        if (device?.gatt?.connected) {
            try {
                device.gatt.disconnect();
            } catch {
                // ignore
            }
        }
        if (hadLink && emitDisconnected) {
            // gattserverdisconnected was detached above, so report it here.
            this.emit("disconnected");
        }
    }

    private detachListeners(): void {
        if (this.onGattDisconnected && this.device) {
            this.device.removeEventListener("gattserverdisconnected", this.onGattDisconnected);
            this.onGattDisconnected = null;
        }
        if (this.onCharacteristicValueChanged && this.characteristic) {
            this.characteristic.removeEventListener(
                "characteristicvaluechanged",
                this.onCharacteristicValueChanged,
            );
            this.onCharacteristicValueChanged = null;
        }
    }

    private mapError(error: unknown): Error {
        const message = error instanceof Error ? error.message : String(error);
        if (/unauthoriz|permission|not allowed|EPERM|access denied/i.test(message)) {
            return this.buildUnauthorizedError();
        }
        if (error instanceof Error) {
            return error;
        }
        return new Error(message);
    }
}

/**
 * webbluetooth reads `value.buffer` without honoring `byteOffset`/`byteLength`.
 * Node allocates small Buffers from a shared 8 KB pool, so the underlying
 * ArrayBuffer must be copied to the exact payload length before writing.
 */
function toExactArrayBuffer(data: Buffer): ArrayBuffer {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return copy.buffer;
}
