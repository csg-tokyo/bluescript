import { BleConnection, DeviceService } from "./ble";
import { ExecutableBinary, MemoryLayout } from "@bscript/lang";

export interface DeviceLogger {
    log(message: string): void;
    error(message: string): void;
}

export class BleDeviceManager {
    private ble: BleConnection | null = null;
    private deviceService: DeviceService | null = null;

    constructor(
        private deviceName: string,
        private deviceLogger: DeviceLogger,
        private onUnexpectedDisconnect?: () => void
    ) {}

    async connect(): Promise<void> {
        this.ble = new BleConnection(this.deviceName);
        await this.ble.connect();
        
        this.ble.on('disconnected', () => {
            if (this.ble?.status !== 'disconnecting') {
                if (this.onUnexpectedDisconnect) {
                    this.onUnexpectedDisconnect();
                } else {
                    process.exit(1);
                }
            }
            this.ble = null;
            this.deviceService = null;
        });

        this.deviceService = this.ble.getService('device');
        this.deviceService.on('log', (message) => this.deviceLogger.log(message));
        this.deviceService.on('error', (message) => this.deviceLogger.error(message));
    }

    async disconnect(): Promise<void> {
        if (this.ble) {
            await this.ble.disconnect();
        }
    }

    async initDevice(): Promise<MemoryLayout> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to initialize device. BLE is not connected.');
        }
        return this.deviceService.init();
    }

    async load(bin: ExecutableBinary): Promise<number> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to load binary. BLE is not connected.');
        }
        return this.deviceService.load(bin);
    }

    async execute(bin: ExecutableBinary): Promise<number> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to execute binary. BLE is not connected.');
        }
        return this.deviceService.execute(bin);
    }
}
