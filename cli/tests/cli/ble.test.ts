// BLE.test.ts

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { Buffer } from 'node:buffer';
import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';

const mockUtils = {
    getHostOSType: jest.fn(),
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
    },
    executeCommand: jest.fn<(command: string, cwd?: string) => Promise<void>>(),
};
jest.mock('../../src/cli/utils', () => mockUtils);

class MockCharacteristic extends EventEmitter {
    writeAsync = jest.fn<(data: Buffer, withoutResponse: boolean)=>Promise<void>>().mockResolvedValue(undefined);
    subscribeAsync = jest.fn<()=>Promise<void>>().mockResolvedValue(undefined);
    unsubscribeAsync = jest.fn<()=>Promise<void>>().mockResolvedValue(undefined);
}

class MockPeripheral extends EventEmitter {
    address = 'mock-address';
    advertisement = {
        localName: 'TestDevice'
    };
    state: 'connected' | 'disconnected' = 'disconnected';

    connectAsync = jest.fn().mockImplementation(async () => {
        this.state = 'connected';
    });
    disconnectAsync = jest.fn().mockImplementation(async () => {
        this.state = 'disconnected';
        this.emit('disconnect');
    });
    discoverSomeServicesAndCharacteristicsAsync 
        = jest.fn<(serviceUUIDs: string[], characteristicUUIDs: string[])=>Promise<{characteristics: MockCharacteristic[]}>>();
}

const mockNoble = new EventEmitter() as any;
mockNoble.startScanningAsync = jest.fn<(serviceUUIDs?: string[], allowDuplicates?: boolean)=> Promise<void>>().mockResolvedValue(undefined);
mockNoble.stopScanningAsync = jest.fn<()=>Promise<void>>().mockResolvedValue(undefined);
mockNoble.state = 'unknown';

jest.mock('@abandonware/noble', () => mockNoble);


// --- Test ---

import BLE from '../../src/cli/ble';

describe('BLE Class', () => {
    let ble: BLE;
    let mockPeripheral: MockPeripheral;
    let mockCharacteristic: MockCharacteristic;
    const deviceName = 'TestDevice';

    beforeEach(() => {
        ble = new BLE(deviceName);
        mockPeripheral = new MockPeripheral();
        mockCharacteristic = new MockCharacteristic();

        mockPeripheral.discoverSomeServicesAndCharacteristicsAsync.mockResolvedValue({
            characteristics: [mockCharacteristic]
        });

        mockNoble.state = 'unknown';
        jest.clearAllMocks();
    });

    afterEach(async () => {
        if (ble.isConnected()) {
            await ble.disconnect();
        }
        mockNoble.removeAllListeners();
        jest.useRealTimers();
    });

    describe('connect', () => {
        it('should connect successfully to the target device', async () => {
            const connectPromise = ble.connect();

            // Simulate the BLE adapter becoming powered on
            mockNoble.state = 'poweredOn';
            mockNoble.emit('stateChange', 'poweredOn');

            // 3. Simulate device discovery
            await new Promise(process.nextTick);
            mockNoble.emit('discover', mockPeripheral);

            // 4. Wait for the connect() promise to resolve
            await connectPromise;

            // --- Verify ---
            expect(ble.isConnected()).toBe(true);
            expect(mockNoble.startScanningAsync).toHaveBeenCalled();
            expect(mockPeripheral.connectAsync).toHaveBeenCalled();
            expect(mockPeripheral.discoverSomeServicesAndCharacteristicsAsync).toHaveBeenCalled();
            expect(mockNoble.stopScanningAsync).toHaveBeenCalled();
        });

        it('should throw an error if characteristic is not found', async () => {
            // Simulate discovery with no characteristics
            mockPeripheral.discoverSomeServicesAndCharacteristicsAsync.mockResolvedValue({
                characteristics: []
            });

            const connectPromise = ble.connect();
            mockNoble.state = 'poweredOn';
            mockNoble.emit('stateChange', 'poweredOn');
            await new Promise(process.nextTick);
            mockNoble.emit('discover', mockPeripheral);

            // Verify that connection fails
            await expect(connectPromise).rejects.toThrow('Target characteristic not found.');
            expect(ble.isConnected()).toBe(false);
            expect(mockPeripheral.disconnectAsync).toHaveBeenCalled(); // 失敗時には切断されるべき
        });
        
        it('should throw an error on connection timeout', async () => {
            jest.useFakeTimers();

            const connectPromise = ble.connect(3000); // Timeout set to 3 seconds
            
            // Simulate the BLE adapter becoming powered on
            mockNoble.state = 'poweredOn';
            mockNoble.emit('stateChange', 'poweredOn');
            
            // Advance time beyond the timeout period
            jest.advanceTimersByTime(5001);

            await expect(connectPromise).rejects.toThrow('BLE connection timed out');
            
            jest.useRealTimers();
        });
    });

    describe('disconnect', () => {
        it('should disconnect from the device', async () => {
            // Setup: Connect first
            const connectPromise = ble.connect();
            mockNoble.state = 'poweredOn';
            mockNoble.emit('stateChange', 'poweredOn');
            await new Promise(process.nextTick);
            mockNoble.emit('discover', mockPeripheral);
            await connectPromise;
            
            expect(ble.isConnected()).toBe(true);
            
            await ble.disconnect();
            
            expect(mockPeripheral.disconnectAsync).toHaveBeenCalled();
            expect(ble.isConnected()).toBe(false);
        });
    });

    describe('writeBuffers', () => {
        beforeEach(async () => {
            const connectPromise = ble.connect();
            mockNoble.state = 'poweredOn';
            mockNoble.emit('stateChange', 'poweredOn');
            await new Promise(process.nextTick);
            mockNoble.emit('discover', mockPeripheral);
            await connectPromise;
        });

        it('should write buffers to the characteristic', async () => {
            const buffers = [Buffer.from('hello'), Buffer.from('world')];
            await ble.writeBuffers(buffers);

            expect(mockCharacteristic.writeAsync).toHaveBeenCalledTimes(2);
            expect(mockCharacteristic.writeAsync).toHaveBeenCalledWith(buffers[0], false);
            expect(mockCharacteristic.writeAsync).toHaveBeenCalledWith(buffers[1], false);
        });

        it('should throw an error if not connected', async () => {
            await ble.disconnect(); 
            const buffers = [Buffer.from('test')];
            
            await expect(ble.writeBuffers(buffers)).rejects.toThrow('Bluetooth device is not connected.');
        });
    });

    describe('Notification Handling', () => {
        beforeEach(async () => {
            const connectPromise = ble.connect();
            mockNoble.state = 'poweredOn';
            mockNoble.emit('stateChange', 'poweredOn');
            await new Promise(process.nextTick);
            mockNoble.emit('discover', mockPeripheral);
            await connectPromise;
        });

        it('should set and receive notifications', () => {
            const handler = jest.fn();
            ble.setNotificationHandler(handler);
            
            // Simulate receiving a notification
            const testData = Buffer.from('notification data');
            mockCharacteristic.emit('data', testData, true); // isNotification = true

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(testData);
        });
        
        it('should not call handler if isNotification is false', () => {
            const handler = jest.fn();
            ble.setNotificationHandler(handler);

            mockCharacteristic.emit('data', Buffer.from('read data'), false); // isNotification = false

            expect(handler).not.toHaveBeenCalled();
        });
        
        it('should remove the notification handler', () => {
            const handler = jest.fn();
            ble.setNotificationHandler(handler);
            ble.removeNotificationHanlder();

            mockCharacteristic.emit('data', Buffer.from('some data'), true);
            
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('subscribe/unsubscribe', () => {
        beforeEach(async () => {
            const connectPromise = ble.connect();
            mockNoble.state = 'poweredOn';
            mockNoble.emit('stateChange', 'poweredOn');
            await new Promise(process.nextTick);
            mockNoble.emit('discover', mockPeripheral);
            await connectPromise;
        });

        it('should call subscribeAsync on startSubscribe', async () => {
            await ble.startSubscribe();
            expect(mockCharacteristic.subscribeAsync).toHaveBeenCalled();
        });

        it('should call unsubscribeAsync on stopSubscribe', async () => {
            await ble.stopSubscribe();
            expect(mockCharacteristic.unsubscribeAsync).toHaveBeenCalled();
        });
    });
});