import {
    BLE_CHARACTERISTIC_UUID,
    BLE_SERVICE_UUID,
    BleTransport,
} from "./ble-transport";
import type { Characteristic, Peripheral } from "@abandonware/noble";

type Noble = typeof import("@abandonware/noble");

const SCAN_SERVICE_UUIDS: string[] = [];

const noble: Noble = require("@abandonware/noble");

/**
 * BLE transport backed by @abandonware/noble (macOS / Windows).
 */
export class NobleBleTransport extends BleTransport {
    private characteristic: Characteristic | null = null;
    private peripheral: Peripheral | null = null;
    private discoverHandler: ((p: Peripheral) => void) | null = null;
    private _scannedDeviceNames: string[] = [];

    get scannedDeviceNames(): readonly string[] {
        return this._scannedDeviceNames;
    }

    async connect(deviceName: string): Promise<void> {
        let unauthorizedHandler: ((state: string) => void) | undefined;

        const unauthorizedPromise = new Promise<never>((_, reject) => {
            unauthorizedHandler = (state: string) => {
                if (state === "unauthorized") {
                    reject(this.buildUnauthorizedError());
                }
            };
            noble.on("stateChange", unauthorizedHandler);
            if (this.isUnauthorized()) {
                reject(this.buildUnauthorizedError());
            }
        });

        try {
            await Promise.race([this.doConnect(deviceName), unauthorizedPromise]);
        } finally {
            if (unauthorizedHandler) {
                noble.removeListener("stateChange", unauthorizedHandler);
            }
        }
    }

    private async doConnect(deviceName: string): Promise<void> {
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

        await noble.startScanningAsync(SCAN_SERVICE_UUIDS, false).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("unauthorized") || this.isUnauthorized()) {
                throw this.buildUnauthorizedError();
            }
            throw error;
        });

        const peripheral = await searchPeripheralPromise;
        await noble.stopScanningAsync();
        this.peripheral = peripheral;

        this.peripheral.on("disconnect", (event) => {
            this.peripheral = null;
            this.characteristic = null;
            this.emit("disconnected", event);
        });
        this.peripheral.on("connect", () => {
            this.emit("connected");
        });

        await peripheral.connectAsync();
        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [BLE_SERVICE_UUID],
            [BLE_CHARACTERISTIC_UUID],
        );
        if (characteristics.length === 0) {
            throw new Error("Target characteristic not found.");
        }
        this.characteristic = characteristics[0];
        this.characteristic.on("data", (data, isNotification) => {
            if (isNotification) {
                this.emit("data", data);
            }
        });
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
    }

    async disconnect(): Promise<void> {
        if (this.characteristic) {
            await this.characteristic.unsubscribeAsync();
            this.characteristic = null;
        }
        if (this.peripheral) {
            await this.peripheral.disconnectAsync();
            this.peripheral = null;
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

    isUnauthorized(): boolean {
        return this.getNobleState() === "unauthorized";
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

    private getNobleState(): string {
        // Prefer the public getter: it triggers noble's lazy binding init.
        // Fall back to _state for environments where only that is available.
        const state = (noble as { state?: string; _state?: string }).state
            ?? (noble as { _state?: string })._state;
        return state ?? "unknown";
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

            const current = this.getNobleState();
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
