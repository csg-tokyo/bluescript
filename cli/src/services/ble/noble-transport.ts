import {
    BLE_CHARACTERISTIC_UUID,
    BLE_SERVICE_UUID,
    BleTransport,
} from "./transport";
import noble, { Characteristic, Peripheral } from "@abandonware/noble";


/**
 * BLE transport backed by @abandonware/noble (macOS).
 */
export class NobleBleTransport extends BleTransport {
    private characteristic: Characteristic | null = null;
    private peripheral: Peripheral | null = null;
    private discoverHandler: ((p: Peripheral) => void) | null = null;
    private peripheralConnectHandler: ((error?: unknown) => void) | null = null;
    private peripheralDisconnectHandler: ((reason?: unknown) => void) | null = null;
    private characteristicDataHandler: ((data: Buffer, isNotification: boolean) => void) | null = null;
    private _scannedDeviceNames: string[] = [];

    get scannedDeviceNames(): readonly string[] {
        return this._scannedDeviceNames;
    }

    async connect(deviceName: string): Promise<void> {
        await this.waitForPoweredOn();

        this._scannedDeviceNames = [];

        const searchPeripheralPromise = new Promise<Peripheral>((resolve) => {
            this.discoverHandler = (p: Peripheral) => {
                const localName = p.advertisement.localName;
                if (localName && !this._scannedDeviceNames.includes(localName)) {
                    this._scannedDeviceNames.push(localName);
                }
                if (localName === deviceName) {
                    noble.removeListener("discover", this.discoverHandler!);
                    this.discoverHandler = null;
                    resolve(p);
                }
            };
            noble.on("discover", this.discoverHandler);
        });

        await noble.startScanningAsync([BLE_SERVICE_UUID], false);

        const peripheral = await searchPeripheralPromise;
        await noble.stopScanningAsync();

        // The same Peripheral instance may carry listeners from a previous session.
        this.detachCharacteristicListeners();
        this.detachPeripheralListeners();
        this.characteristic = null;
        this.peripheral = peripheral;

        this.peripheralDisconnectHandler = (reason?: unknown) => {
            this.detachCharacteristicListeners();
            this.detachPeripheralListeners();
            this.characteristic = null;
            this.peripheral = null;
            this.emit("disconnected", reason);
        };
        this.peripheralConnectHandler = (error?: unknown) => {
            // noble reports failures through the same `connect` event;
            // connectAsync rejects with that error, so stay silent here.
            if (error) {
                return;
            }
            this.emit("connected");
        };
        peripheral.on("disconnect", this.peripheralDisconnectHandler);
        peripheral.on("connect", this.peripheralConnectHandler);

        await peripheral.connectAsync();
        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [BLE_SERVICE_UUID],
            [BLE_CHARACTERISTIC_UUID],
        );
        if (characteristics.length === 0) {
            throw new Error("Target characteristic not found.");
        }
        this.characteristic = characteristics[0];
        this.characteristicDataHandler = (data, isNotification) => {
            if (isNotification) {
                this.emit("data", data);
            }
        };
        this.characteristic.on("data", this.characteristicDataHandler);
        await this.characteristic.subscribeAsync();
    }

    async abortConnect(): Promise<void> {
        if (this.discoverHandler) {
            noble.removeListener("discover", this.discoverHandler);
            this.discoverHandler = null;
        }
        try {
            await noble.stopScanningAsync();
        } catch {
            // ignore if scanning is not active
        }

        // Give up on an in-flight link so it cannot finish connecting after the
        // caller already treated the attempt as failed.
        const peripheral = this.peripheral;
        this.detachCharacteristicListeners();
        this.detachPeripheralListeners();
        this.characteristic = null;
        this.peripheral = null;
        if (!peripheral) {
            return;
        }
        try {
            if (peripheral.state === "connecting") {
                peripheral.cancelConnect();
            } else if (peripheral.state === "connected") {
                await peripheral.disconnectAsync();
            }
        } catch {
            // ignore: the attempt is already being abandoned
        }
    }

    async disconnect(): Promise<void> {
        const characteristic = this.characteristic;
        const peripheral = this.peripheral;
        this.detachCharacteristicListeners();
        this.detachPeripheralListeners();
        this.characteristic = null;
        this.peripheral = null;

        if (characteristic) {
            try {
                await characteristic.unsubscribeAsync();
            } catch {
                // Best-effort: the link may already be gone.
            }
        }
        if (peripheral) {
            try {
                await peripheral.disconnectAsync();
            } catch {
                // ignore
            }
            // Our peripheral listener is already detached, so report it here.
            this.emit("disconnected");
        }
    }

    async write(data: Buffer): Promise<void> {
        if (!this.characteristic) {
            throw new Error("BLE characteristic is not available.");
        }
        // withoutResponse = false → write with response (matches previous behavior)
        await this.characteristic.writeAsync(data, false);
    }

    isReady(): boolean {
        return this.peripheral?.state === "connected" && this.characteristic != null;
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

    private detachPeripheralListeners(): void {
        if (this.peripheralConnectHandler) {
            this.peripheral?.removeListener("connect", this.peripheralConnectHandler);
            this.peripheralConnectHandler = null;
        }
        if (this.peripheralDisconnectHandler) {
            this.peripheral?.removeListener("disconnect", this.peripheralDisconnectHandler);
            this.peripheralDisconnectHandler = null;
        }
    }

    private detachCharacteristicListeners(): void {
        if (this.characteristicDataHandler) {
            this.characteristic?.removeListener("data", this.characteristicDataHandler);
            this.characteristicDataHandler = null;
        }
    }

    private isTransientNobleState(state: string): boolean {
        return state === "unknown" || state === "resetting";
    }

    private async waitForPoweredOn(): Promise<void> {
        return new Promise((resolve, reject) => {
            const onStateChange = (state: string) => {
                if (state === "poweredOn") {
                    cleanup();
                    resolve();
                    return;
                }
                if (state === "unauthorized") {
                    cleanup();
                    reject(this.buildUnauthorizedError());
                    return;
                }
                if (!this.isTransientNobleState(state)) {
                    cleanup();
                    reject(new Error(`Bluetooth adapter state is ${state}`));
                }
            };

            const cleanup = () => {
                noble.removeListener("stateChange", onStateChange);
            };

            // Register first so we do not miss an async unauthorized/poweredOn event.
            noble.on("stateChange", onStateChange);

            const current = noble._state;
            if (current === "poweredOn") {
                cleanup();
                resolve();
                return;
            }
            if (current === "unauthorized") {
                cleanup();
                reject(this.buildUnauthorizedError());
                return;
            }
            if (!this.isTransientNobleState(current)) {
                cleanup();
                reject(new Error(`Bluetooth adapter state is ${current}`));
            }
        });
    }
}
