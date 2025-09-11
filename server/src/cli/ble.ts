import noble, { Characteristic, Peripheral } from '@abandonware/noble';
import { Buffer } from "node:buffer";
import { logger } from "./utils";
import { BLE_SERVICE_UUID, BLE_CHARACTERISTIC_UUID } from './constants';

export const MAX_MTU = 495;

type BleState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

export default class BLE {
    private characteristic?: Characteristic;
    private peripheral?: Peripheral;
    private readonly deviceName: string;
    private notificationHandler?: (data: Buffer, isNotification: boolean) => void;
    private state: BleState = 'disconnected';

    constructor(deviceName: string) {
        this.deviceName = deviceName;
    }

    isConnected(): boolean {
        return this.state === 'connected' && this.peripheral?.state === 'connected';
    }

    private async _waitForPoweredOn(): Promise<void> {
        if (noble._state === 'poweredOn') {
            return;
        }
        return new Promise((resolve, reject) => {
            const stateChangeHandler = (state: string) => {
                if (state === 'poweredOn') {
                    noble.removeListener('stateChange', stateChangeHandler);
                    resolve();
                } else if (state !== 'unknown' && state !== 'resetting') {
                    noble.removeListener('stateChange', stateChangeHandler);
                    reject(new Error(`Bluetooth adapter state is ${state}`));
                }
            };
            noble.on('stateChange', stateChangeHandler);
        });
    }

    async connect(timeoutMs: number = 20000): Promise<void> {
        if (this.state !== 'disconnected') {
            logger.warn('[Bluetooth] Already connected or connecting.');
            return;
        }

        this.state = 'connecting';
        let timeoutHandle: NodeJS.Timeout | undefined = undefined;

        try {
            const connectPromise = this._doConnect();
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(
                    () => reject(new Error('BLE connection timed out')),
                    timeoutMs
                );
            });
            await Promise.race([connectPromise, timeoutPromise]);
            this.state = 'connected';
            logger.info('[Bluetooth] Connection successful.');
        } catch (error) {
            this.state = 'disconnected';
            logger.error(`[Bluetooth] Connection failed: ${error}`);
            await this.disconnect();
            throw error;
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private async _doConnect(): Promise<void> {
        logger.info("[Bluetooth] Initializing...");
        await this._waitForPoweredOn();

        logger.info(`[Bluetooth] Scanning for ${this.deviceName}...`);
        await noble.startScanningAsync([BLE_SERVICE_UUID], false);

        const peripheral = await new Promise<Peripheral>((resolve) => {
            const discoverHandler = (p: Peripheral) => {
                if (p.advertisement.localName === this.deviceName) {
                    noble.removeListener('discover', discoverHandler);
                    resolve(p);
                }
            };
            noble.on('discover', discoverHandler);
        });

        await noble.stopScanningAsync();
        this.peripheral = peripheral;

        logger.info(`[Bluetooth] Found target device: ${this.deviceName} (${peripheral.address})`);

        this.peripheral.once('disconnect', () => {
            if (this.state !== 'disconnecting') {
                logger.warn(`[Bluetooth] Device disconnected.`);
                this.state = 'disconnected';
                this.peripheral = undefined;
                this.characteristic = undefined;
            }
        });

        logger.info(`[Bluetooth] Connecting to ${peripheral.address}...`);
        await peripheral.connectAsync();
        logger.info('[Bluetooth] Connected.');

        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [BLE_SERVICE_UUID],
            [BLE_CHARACTERISTIC_UUID]
        );

        if (characteristics.length === 0) {
            throw new Error('Target characteristic not found.');
        }
        this.characteristic = characteristics[0];
        logger.info('[Bluetooth] Discovered services and characteristics.');
    }

    async disconnect(): Promise<void> {
        this.state = 'disconnecting';
        this.removeNotificationHanlder();
        if (this.peripheral) {
            logger.info(`[Bluetooth] Disconnecting from ${this.peripheral.address}.`);
            await this.peripheral.disconnectAsync();
        }
        this.peripheral = undefined;
        this.characteristic = undefined;
        this.state = 'disconnected';
        logger.info('[Bluetooth] Disconnected.');
    }

    async writeBuffers(buffers: Buffer[]): Promise<void> {
        if (!this.isConnected() || !this.characteristic) {
            throw new Error('Bluetooth device is not connected.');
        }
        for (const buff of buffers) {
            await this.characteristic.writeAsync(buff, false);
        }
    }

    setNotificationHandler(handler: (data: Buffer) => void): void {
        if (!this.characteristic) {
            logger.warn('[Bluetooth] Cannot set notification handler, characteristic is not available.');
            return;
        }
        this.removeNotificationHanlder();
        this.notificationHandler = (data, isNotification) => {
            if (isNotification) handler(data);
        };
        this.characteristic.on('data', this.notificationHandler);
    }

    removeNotificationHanlder(): void {
        if (this.notificationHandler && this.characteristic) {
            this.characteristic.off('data', this.notificationHandler);
            this.notificationHandler = undefined;
        }
    }

    addTempNotificationHandler(handler: (data: Buffer) => void): void {
        this.characteristic?.once('data', (data, isNotification) => {
            if (isNotification) handler(data);
        });
    }

    async startSubscribe(): Promise<void> {
        if (!this.isConnected() || !this.characteristic) {
            throw new Error('Bluetooth device is not connected.');
        }
        await this.characteristic.subscribeAsync();
    }

    async stopSubscribe(): Promise<void> {
        if (!this.isConnected() || !this.characteristic) {
            logger.warn('[Bluetooth] Cannot unsubscribe, device is not connected.');
            return;
        }
        await this.characteristic.unsubscribeAsync();
    }
}