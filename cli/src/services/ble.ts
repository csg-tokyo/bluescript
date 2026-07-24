import noble, { Characteristic, Peripheral } from '@abandonware/noble';
import { Buffer } from "node:buffer";
import { MemoryImage, MemoryLayout } from "@bscript/lang";
import { logger } from "../core/logger";
import { Connection, ConnectionMessage, Service } from "./common";
import { Protocol, ProtocolPacketBuilder, ProtocolParser } from './device-protocol';


const MTU = 495;
const SERVICE_UUID = 'b500';
const CHARACTERISTIC_UUID = 'b501';


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

    public async load(bin: MemoryImage, onPacketSent?: (percent: number) => void): Promise<number>  {
        const builder = new ProtocolPacketBuilder(MTU);
        if (bin.iram) builder.load(bin.iram.address, bin.iram.data);
        if (bin.dram) builder.load(bin.dram.address, bin.dram.data);
        if (bin.iflash) builder.load(bin.iflash.address, bin.iflash.data);
        if (bin.dflash) builder.load(bin.dflash.address, bin.dflash.data);
        const startLoading = performance.now();
        await this.send('load', builder.build(), onPacketSent);
        return performance.now() - startLoading;
    }

    public async execute(bin: MemoryImage): Promise<number> {
        const builder = new ProtocolPacketBuilder(MTU);
        const isMain = 1;
        for (const entryPoint of bin.entryPoints) {
            builder.jump(entryPoint.isMain ? isMain : 0, entryPoint.address);
        }
        let executionTime = 0;
        const p = new Promise<number>((resolve) => {
            this.on('exectime', (id, time) => {
                executionTime += time;
                if (id === isMain) {
                    resolve(executionTime);
                    this.off('exectime');
                }
            });
        });
        await this.send('execute', builder.build());
        return p;
    }

    public async init(): Promise<MemoryLayout> {
        const builder = new ProtocolPacketBuilder(MTU).reset();
        const p = new Promise<MemoryLayout>((resolve) => {
            this.once('memory', (layout) => {
                resolve(layout);
            });
        });
        await this.send('init', builder.build());
        return p;
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
        let unauthorizedHandler: ((state: string) => void) | undefined = undefined;
        try {
            const connectPromise = this.doConnect();
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(
                    () => reject(this.buildConnectTimeoutOrUnauthorizedError()),
                    timeoutMs
                );
            });
            // Watch for `unauthorized` for the whole connection attempt. On Linux
            // (hci-socket) the adapter often reports `poweredOn` first and only
            // becomes `unauthorized` once scanning actually touches the HCI socket,
            // which happens after waitForPoweredOn has already resolved.
            const unauthorizedPromise = new Promise<never>((_, reject) => {
                unauthorizedHandler = (state: string) => {
                    if (state === 'unauthorized') {
                        reject(this.buildUnauthorizedBluetoothError());
                    }
                };
                noble.on('stateChange', unauthorizedHandler);
                if (this.getNobleState() === 'unauthorized') {
                    reject(this.buildUnauthorizedBluetoothError());
                }
            });
            await Promise.race([connectPromise, timeoutPromise, unauthorizedPromise]);
        } catch (error) {
            await this.abortConnect();
            throw error;
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            if (unauthorizedHandler) {
                noble.removeListener('stateChange', unauthorizedHandler);
            }
        }
    }

    private buildConnectTimeoutOrUnauthorizedError(): Error {
        if (this.getNobleState() === 'unauthorized') {
            return this.buildUnauthorizedBluetoothError();
        }
        return this.buildConnectionTimeoutError();
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
        const searchPeriferalPromise = new Promise<Peripheral>((resolve) => {
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
        await noble.startScanningAsync([SERVICE_UUID], false).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('unauthorized') || this.getNobleState() === 'unauthorized') {
                throw this.buildUnauthorizedBluetoothError();
            }
            throw error;
        });
        const peripheral = await searchPeriferalPromise;
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
        return;
    }

    private getNobleState(): string {
        // Prefer the public getter: it triggers noble's lazy binding init.
        // Fall back to _state for environments where only that is available.
        const state = (noble as { state?: string; _state?: string }).state
            ?? (noble as { _state?: string })._state;
        return state ?? 'unknown';
    }

    private isTransientNobleState(state: string): boolean {
        return state === 'unknown' || state === 'resetting';
    }

    private async waitForPoweredOn(): Promise<void> {
        return new Promise((resolve, reject) => {
            const onStateChange = (state: string) => {
                if (state === 'poweredOn') {
                    cleanup();
                    resolve();
                    return;
                }
                if (state === 'unauthorized') {
                    cleanup();
                    reject(this.buildUnauthorizedBluetoothError());
                    return;
                }
                if (!this.isTransientNobleState(state)) {
                    cleanup();
                    reject(new Error(`Bluetooth adapter state is ${state}`));
                }
            };

            const cleanup = () => {
                noble.removeListener('stateChange', onStateChange);
            };

            // Register first so we do not miss an async unauthorized/poweredOn event.
            noble.on('stateChange', onStateChange);

            // Accessing noble.state triggers lazy init if needed, then re-check.
            const current = this.getNobleState();
            if (current === 'poweredOn') {
                cleanup();
                resolve();
                return;
            }
            if (current === 'unauthorized') {
                cleanup();
                reject(this.buildUnauthorizedBluetoothError());
                return;
            }
            if (!this.isTransientNobleState(current)) {
                cleanup();
                reject(new Error(`Bluetooth adapter state is ${current}`));
            }
        });
    }

    private buildUnauthorizedBluetoothError(): Error {
        if (process.platform === 'linux') {
            const caps = 'cap_net_raw,cap_net_admin+eip';
            return new Error(
                `Bluetooth adapter is unauthorized.\n\n` +
                `On Linux, grant capabilities to the Node.js binary and retry:\n` +
                `  sudo setcap ${caps} $(readlink -f "$(which node)")\n\n` +
                `Or re-run: bscript board setup esp32\n` +
                `Note: after upgrading or switching Node.js versions, you may need to run setcap again.`,
            );
        }
        if (process.platform === 'darwin') {
            return new Error(
                `Bluetooth adapter is unauthorized.\n\n` +
                `On macOS, allow Bluetooth access for the app that runs bscript:\n` +
                `  System Settings → Privacy & Security → Bluetooth\n` +
                `  → enable Terminal, iTerm2, or whichever app you use.\n\n` +
                `Also make sure Bluetooth is turned on.`,
            );
        }
        return new Error(
            `Bluetooth adapter is unauthorized.\n\n` +
            `Please check Bluetooth permissions and that Bluetooth is enabled, then retry.`,
        );
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

    public async send(message: ConnectionMessage<Buffer>, onPacketSent?: (percent: number) => void): Promise<void> {
        if (this.peripheral &&  this.characteristic && this.peripheral.state === 'connected') {
            const totalSize = message.payload.reduce((acc, curr) => acc + curr.length, 0);
            let sentSize = 0;
            for (const buff of message.payload) {
                await this.characteristic.writeAsync(buff, false);
                sentSize += buff.length;
                onPacketSent?.(Math.floor(sentSize / totalSize * 100));
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