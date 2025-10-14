import noble, { Characteristic, Peripheral } from '@abandonware/noble';
import { Buffer } from "node:buffer";
import { ExecutableBinary, MemoryLayout } from "@bluescript/compiler";
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
    }

    public async execute(bin: ExecutableBinary): Promise<{sendingTime: number, executionTime: number}>  {
        const builder = new ProtocolPacketBuilder(MTU);
        if (bin.iram) builder.load(bin.iram.address, bin.iram.data);
        if (bin.dram) builder.load(bin.dram.address, bin.dram.data);
        if (bin.iflash) builder.load(bin.iflash.address, bin.iflash.data);
        if (bin.dflash) builder.load(bin.dflash.address, bin.dflash.data);
        for (const entryPoint of bin.entryPoints) {
            builder.jump(entryPoint.isMain ? 0 : -1, entryPoint.address);
        }
        const startSending = performance.now();
        await this.send('execute', builder.build());
        const sendingTime = performance.now() - startSending;
        let executionTime = 0;
        return new Promise<{sendingTime: number, executionTime: number}>((resolve) => {
            this.on('exectime', (id, time) => {
                executionTime += time;
                if (id === 0) {
                    resolve({sendingTime, executionTime});
                }
            })
        });
    }

    public async init(): Promise<MemoryLayout> {
        const builder = new ProtocolPacketBuilder(MTU).reset();
        await this.send('init', builder.build()); // TODO: generate binary
        return new Promise<MemoryLayout>((resolve) => {
            this.on('memory', (layout) => {
                resolve(layout);
            })
        })
    }
}


export class BleConnection extends Connection<Buffer> {
    public status: 'connected' | 'connecting' | 'disconnected' | 'disconnecting' = 'disconnected';
    private deviceName: string;
    private characteristic: Characteristic|null = null;
    private peripheral: Peripheral|null = null;
    private services: Map<string, Service<any, Buffer>> = new Map();

    constructor(deviceName: string) {
        super();
        this.deviceName = deviceName;
    }

    public async connect(timeoutMs: number = 2000): Promise<void> {
        let timeoutHandle: NodeJS.Timeout | undefined = undefined;

        try {
            const connectPromise = this.doConnect();
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(
                    () => reject(new Error('BLE connection timed out')),
                    timeoutMs
                );
            });
            await Promise.race([connectPromise, timeoutPromise]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private async doConnect(): Promise<void> {
        this.status = 'connecting';
        await this.waitForPoweredOn();

        await noble.startScanningAsync([SERVICE_UUID], false);
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
        this.peripheral.on('disconnect', (event) => {
            this.status = 'disconnected';
            this.emit('disconnected', event);
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
                this.handleReceivedData(data);
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

    private handleReceivedData(data: Buffer) {
        const service = this.services.get('device');
        if (!service) { return }
        const parseResult = new ProtocolParser().parse(data);
        switch(parseResult.protocol) {
            case Protocol.Log:
                service.handleMessage('log', [parseResult.log]);
                break;
            case Protocol.Error:
                service.handleMessage('error', [parseResult.error]);
                break;
            case Protocol.Profile:
                service.handleMessage('profile', [parseResult.fid, parseResult.paramtypes]);
                break;
            case Protocol.Exectime:
                service.handleMessage('exectime', [parseResult.id, parseResult.time]);
                break;
            case Protocol.Memory:
                service.handleMessage('memory', [parseResult.layout]);
        }
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
            console.error("WebSocket is not connected.");
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