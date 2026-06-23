import noble, { Characteristic, Peripheral } from '@abandonware/noble';
import { Buffer } from "node:buffer";
import { MemoryImage, MemoryLayout } from "@bscript/lang";
import { logger } from "../core/logger";
import { Connection, ConnectionMessage, Service } from "./common";
import { Protocol, ProtocolPacketBuilder, ProtocolParser } from './device-protocol';


const MTU = 495;
const SERVICE_UUID = '00ff';
const CHARACTERISTIC_UUID = 'ff01';


export type DeviceServiceEvents = {
    log: (message: string) => void;
    error: (message: string) => void;
    profile: (fid:number, paramtypes:string[]) => void;
    exectime: (id: number, time: number) => void;
    memory: (layout: MemoryLayout) => void;
}

export class DeviceService extends Service<DeviceServiceEvents, Buffer> {
    constructor(connection: BleConnection) {
        super('device', connection);
        this.connection.on('receiveData', data => {
            this.handleReceivedData(data);
        })
    }

    public async load(bin: MemoryImage): Promise<number>  {
        const builder = new ProtocolPacketBuilder(MTU);
        if (bin.iram) builder.load(bin.iram.address, bin.iram.data);
        if (bin.dram) builder.load(bin.dram.address, bin.dram.data);
        if (bin.iflash) builder.load(bin.iflash.address, bin.iflash.data);
        if (bin.dflash) builder.load(bin.dflash.address, bin.dflash.data);
        const startLoading = performance.now();
        await this.send('load', builder.build());
        return performance.now() - startLoading;
    }

    public async execute(bin: MemoryImage): Promise<number> {
        const builder = new ProtocolPacketBuilder(MTU);
        const isMain = 1;
        for (const entryPoint of bin.entryPoints) {
            builder.jump(entryPoint.isMain ? isMain : 0, entryPoint.address);
        }
        await this.send('execute', builder.build());
        let executionTime = 0;
        return new Promise<number>((resolve) => {
            this.on('exectime', (id, time) => {
                executionTime += time;
                if (id === isMain) {
                    resolve(executionTime);
                    this.off('exectime');
                }
            });
        });
    }

    public async init(): Promise<MemoryLayout> {
        const builder = new ProtocolPacketBuilder(MTU).reset();
        await this.send('init', builder.build());
        return new Promise<MemoryLayout>((resolve) => {
            this.once('memory', (layout) => {
                resolve(layout);
            });
        });
    }

    private handleReceivedData(data: Buffer) {
        const parseResult = new ProtocolParser().parse(data);
        switch(parseResult.protocol) {
            case Protocol.Log:
                this.handleMessage('log', [parseResult.log]);
                break;
            case Protocol.Error:
                this.handleMessage('error', [parseResult.error]);
                break;
            case Protocol.Profile:
                this.handleMessage('profile', [parseResult.fid, parseResult.paramtypes]);
                break;
            case Protocol.Exectime:
                this.handleMessage('exectime', [parseResult.id, parseResult.time]);
                break;
            case Protocol.Memory:
                this.handleMessage('memory', [parseResult.layout]);
        }
    }
}


export class BleConnection extends Connection<Buffer> {
    public status: 'connected' | 'connecting' | 'disconnected' | 'disconnecting' = 'disconnected';
    private deviceName: string;
    private characteristic: Characteristic|null = null;
    private peripheral: Peripheral|null = null;
    private services: Map<string, Service<any, Buffer>> = new Map();

    private foundPeriferals: Peripheral[] = [];
    private discoverHandler: ((p: Peripheral) => void) | null = null;

    constructor(deviceName: string) {
        super();
        this.deviceName = deviceName;
    }

    public async connect(timeoutMs: number = 5000): Promise<void> {
        let timeoutHandle: NodeJS.Timeout | undefined = undefined;
        try {
            const connectPromise = this.doConnect();
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(
                    () => reject(this.buildConnectionTimeoutError()),
                    timeoutMs
                );
            });
            await Promise.race([connectPromise, timeoutPromise]);
        } catch (error) {
            await this.abortConnect();
            throw error;
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private buildConnectionTimeoutError(): Error {
        const scannedNames = [...new Set(
            this.foundPeriferals
                .map(p => p.advertisement.localName)
                .filter((name): name is string => name != null && name !== '')
        )];
        const scanResult = scannedNames.length > 0
            ? scannedNames.map(name => `  - "${name}"`).join('\n')
            : '  (none)';

        return new Error(
            `BLE connection timed out while looking for device "${this.deviceName}".\n\n` +
            `Nearby devices found during scan:\n${scanResult}\n\n` +
            `Please check the following:\n` +
            `  1. Is the device powered on?\n` +
            `  2. Does the device name match between flash and connect?\n` +
            `     Connect is looking for: "${this.deviceName}"\n` +
            `     Flash sets the name via \`bscript board flash-runtime <board> -d <name>\`.\n` +
            `     Connect uses \`deviceName\` in bsconfig.json (or \`-d\` for REPL).\n` +
            `     If the names differ, re-flash or update the connect name to match.`
        );
    }

    private async abortConnect(): Promise<void> {
        if (this.discoverHandler) {
            noble.removeListener('discover', this.discoverHandler);
            this.discoverHandler = null;
        }
        try {
            await noble.stopScanningAsync();
        } catch {
            // ignore if scanning is not active
        }
        if (this.status === 'connecting') {
            this.status = 'disconnected';
        }
    }

    private async doConnect(): Promise<void> {
        this.status = 'connecting';
        await this.waitForPoweredOn();

        this.foundPeriferals = [];
        await noble.startScanningAsync([SERVICE_UUID], false);
        const peripheral = await new Promise<Peripheral>((resolve) => {
            this.discoverHandler = (p: Peripheral) => {
                this.foundPeriferals.push(p);
                if (p.advertisement.localName === this.deviceName) {
                    noble.removeListener('discover', this.discoverHandler!);
                    this.discoverHandler = null;
                    resolve(p);
                }
            };
            noble.on('discover', this.discoverHandler);
        });
        await noble.stopScanningAsync();
        this.peripheral = peripheral;
        this.peripheral.on('disconnect', (event) => {
            this.emit('disconnected', event);
            this.status = 'disconnected';
            this.peripheral = null;
            this.characteristic = null;
        });
        this.peripheral.on('connect', () => {
            this.status = 'connected';
            this.emit('connected');
        });
        await peripheral.connectAsync();

        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [SERVICE_UUID],
            [CHARACTERISTIC_UUID]
        );
        if (characteristics.length === 0) {
            throw new Error('Target characteristic not found.');
        }
        this.characteristic = characteristics[0];
        this.characteristic.on('data', (data, isNotification) => {
            if (isNotification) {
                this.emit('receiveData', data);
            }
        })
        await this.characteristic.subscribeAsync();
    }

    private async waitForPoweredOn(): Promise<void> {
        if (noble._state === 'poweredOn') {
            return;
        }
        return new Promise((resolve, reject) => {
            noble.once('stateChange', (state: string) => {
                if (state === 'poweredOn') {
                    resolve();
                } else if (state !== 'unknown' && state !== 'resetting') {
                    reject(new Error(`Bluetooth adapter state is ${state}`));
                }
            });
        });
    }

    public async disconnect(): Promise<void> {
        if (this.characteristic) {
            await this.characteristic.unsubscribeAsync();
            this.characteristic = null;
        }
        if (this.peripheral) {
            this.status = 'disconnecting';
            await this.peripheral.disconnectAsync();
            this.peripheral = null;
        }
    }

    public async send(message: ConnectionMessage<Buffer>): Promise<void> {
        if (this.peripheral &&  this.characteristic && this.peripheral.state === 'connected') {
            for (const buff of message.payload) {
                await this.characteristic.writeAsync(buff, false);
            }
        } else {
            logger.error("BLE is not connected.");
        }
    }
    
    public getService(serviceName: 'device'): DeviceService;
    public getService<T extends Service<any, Buffer>>(serviceName: string): T;
    public getService(serviceName: string): Service<any, Buffer> {
        if (this.services.has(serviceName)) {
            return this.services.get(serviceName)!;
        }

        let service: Service<any, Buffer>;
        switch (serviceName) {
            case 'device':
                service = new DeviceService(this);
                break;
            default:
                throw new Error(`Unknown service: ${serviceName}`);
        }

        this.services.set(serviceName, service);
        return service;
    }
}