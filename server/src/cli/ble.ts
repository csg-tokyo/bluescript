import noble, {Characteristic, Peripheral} from '@abandonware/noble';
import {Buffer} from "node:buffer";
import { logger } from "./utils";
import { BLE_SERVICE_UUID, BLE_CHARACTERISTIC_UUID } from './constants';

export const MAX_MTU = 495;


export default class BLE {
    characteristic?: Characteristic;
    peripheral?: Peripheral;
    deviceName: string;
    private notificationHandler?:(data: Buffer, isNotification: boolean)=>void;

    constructor(deviceName: string) {
        this.deviceName = deviceName;
    }

    isConnected() {
        if (this.peripheral === undefined || this.characteristic === undefined) {
            return false;
        }
        if (this.peripheral.state === 'disconnected') {
            return false;
        }
        return true;
    }

    async connect() {
        logger.info("[Bluetooth] Invoking...");
        await new Promise<void>((resolve) => {
            noble.on('stateChange', (state) => {
                if (state === 'poweredOn') {
                    resolve();
                }
            });
        });
        logger.info("[Bluetooth] Scanning...");
        await noble.startScanningAsync();
    
        await new Promise<void>((resolve, reject) => {
            noble.on('discover', async (peripheral) => {
                if (peripheral.advertisement.localName === this.deviceName) {
                    logger.info(`[Bluetooth] Found target device: ${this.deviceName}`);
                    this.peripheral = peripheral;
                    await noble.stopScanningAsync();
                    
                    try {
                        logger.info(`[Bluetooth] Connecting to ${peripheral.address}...`);
                        await peripheral.connectAsync();
                        logger.info('[Bluetooth] Connected.');
    
                        const { services, characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
                            [BLE_SERVICE_UUID],
                            [BLE_CHARACTERISTIC_UUID]
                        );
                        
                        if (characteristics.length > 0) {
                            logger.info('[Bluetooth] Discovered services and characteristics.');
                            this.characteristic = characteristics[0];
                            resolve();
                        } else {
                            logger.error('[Bluetooth] Target characteristic not found.');
                            await peripheral.disconnectAsync();
                            reject();
                        }
                    } catch (error) {
                        logger.error(`[Bluetooth] ${error}`);
                        await peripheral.disconnectAsync();
                        reject();
                    }
                }
            });
        });
    }

    async disconnect() {
        logger.info(`[Bluetooth] Disconnecting device.`);
        this.peripheral?.disconnectAsync();
        logger.info('[Bluetooth] Disconnected.');
    }

    async writeBuffers(buffers: Buffer[]) {
        if (!this.isConnected()) {
            logger.error('[Bluetooth] device is not connected.');
            return;
        }
        for (const buff of buffers) {
            await this.characteristic?.writeAsync(buff, false);
        }
    }

    setNotificationHandler(handler: (data: Buffer) => void) {
        this.notificationHandler = (data: Buffer, isNotification: boolean) => {
            if (isNotification) {
                handler(data);
            }
        }
        this.characteristic?.on('data', this.notificationHandler);
    }

    removeNotificationHanlder() {
        if (this.notificationHandler !== undefined) {
            this.characteristic?.off('data', this.notificationHandler);
        }
    }

    addTempNotificationHandler(handler: (data: Buffer) => void) {
        this.characteristic?.once('data', (data: Buffer, isNotification) => {
            if (isNotification) {
                handler(data);
            }
        });
    }

    async startSubscribe() {
        if (!this.isConnected()) {
            logger.error('[Bluetooth] device is not connected.');
            return;
        }
        this.characteristic?.subscribeAsync();
    }

    async stopSubscribe() {
        if (!this.isConnected()) {
            logger.error('[Bluetooth] device is not connected.');
            return;
        }
        this.characteristic?.unsubscribeAsync();
    }
}