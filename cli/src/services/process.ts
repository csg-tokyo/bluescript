import { logger } from "../core/logger";
import { Connection, ConnectionMessage, Service } from "./common";
import { hostProtocolBuilder, HostProtocolParser, HostProtocol, HostParseResult } from "./host-protocol";
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';


export type HostServiceEvents = {
    log: (message: string) => void;
    error: (message: string) => void;
    exectime: (time: number) => void;
    loadtime: (time: number) => void;
}

export class HostService extends Service<HostServiceEvents, string> {
    messageQueue: HostMessageQueue;

    constructor(connection: ProcessConnection) {
        super('host', connection);
        this.messageQueue = new HostMessageQueue(this);
        this.connection.on('receiveData', (message) => {
            this.messageQueue.addChunk(message);
        });
        this.connection.on('receiveError', (message) => {
            this.handleMessage('error', [message]);
        });
    }

    public async load(soFile: string): Promise<number>  {
        const line = hostProtocolBuilder(HostProtocol.Load, soFile);
        await this.send('load', [line]);
        return new Promise<number>((resolve) => {
            this.on('loadtime', (time) => {
                resolve(time);
                this.off('loadtime');
            });
        });
    }

    public async execute(entryPointName: string): Promise<number> {
        const line = hostProtocolBuilder(HostProtocol.Call, entryPointName);
        await this.send('execute', [line]);
        return new Promise<number>((resolve) => {
            this.on('exectime', (time) => {
                resolve(time);
                this.off('exectime');
            });
        });
    }
}


class HostMessageQueue {
    service: HostService;
    private queue: HostParseResult[];
    private incompleteChunk: string;
    private parser: HostProtocolParser;

    constructor(service: HostService) {
        this.service = service;
        this.queue = [];
        this.incompleteChunk = "";
        this.parser = new HostProtocolParser();
    }

    addChunk(chunk: string) {
        this.incompleteChunk += chunk;
        const { parsed, remain } = this.parser.parse(this.incompleteChunk);
        this.incompleteChunk = remain;
        this.queue = this.queue.concat(parsed);
        queueMicrotask(() => {
            this.publish();
        });
    }

    publish() {
        if (this.queue.length > 0) {
            const message = this.queue.shift()!;
            switch(message.protocol) {
                case HostProtocol.Log:
                    this.service.handleMessage('log', [message.log]);
                    break;
                case HostProtocol.Error:
                    this.service.handleMessage('error', [message.error]);
                    break;
                case HostProtocol.Exectime:
                    this.service.handleMessage('exectime', [message.time]);
                    break;
                case HostProtocol.Loadtime:
                    this.service.handleMessage('loadtime', [message.time]);
                    break;
                default:
                    throw new Error("Unexpected error.");
            }
        }
        if (this.queue.length > 0) {
            queueMicrotask(() => {
                this.publish();
            });
        }
    }
}


export class ProcessConnection extends Connection<String> {
    private shellFile: string;
    private services = new Map<string, Service<any, string>>();
    private shellProcess: ChildProcessWithoutNullStreams | null = null;


    constructor(shellFile: string) {
        super();
        this.shellFile = shellFile;
    }

    public async connect(): Promise<void> {
        this.shellProcess = spawn(this.shellFile);
        this.shellProcess.on('exit', (code, signal) => {
            if (code === 0)
                this.emit('disconnected', 0);
            else
                this.emit('disconnected', 1);
        });

        this.shellProcess.stdout.setEncoding('utf8');
        this.shellProcess.stderr.setEncoding('utf8');
        this.shellProcess.stdout.on('data', (message) => {
            this.emit('receiveData', message);
        });
        this.shellProcess.stderr.on('data', (message) => {
            this.emit('receiveError', message);
        });
        this.emit('connected');
    }

    public async disconnect(): Promise<void> {
        if (!this.checkProcessRunning(this.shellProcess)) {
            return;
        }

        const proc = this.shellProcess;
        this.shellProcess = null;

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                proc.kill('SIGKILL');
                resolve();
            }, 3_000);

            proc.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });

            proc.stdin.end();
            proc.kill();
        });

        this.emit('disconnected', 0);
    }

    public async send(message: ConnectionMessage<string>): Promise<void> {
        if (this.checkProcessRunning(this.shellProcess)) {
            for (const line of message.payload) {
                this.shellProcess.stdin.cork();
                this.shellProcess.stdin.write(line);
                process.nextTick(() => this.shellProcess?.stdin.uncork());
            }
        }
    }

    private checkProcessRunning(process: ChildProcessWithoutNullStreams | null): process is ChildProcessWithoutNullStreams {
        if (process) {
            return true;
        } else {
            logger.error("The process is not running.");
            return false;
        }
    }  
    
    public getService(serviceName: 'host'): HostService;
    public getService<T extends Service<any, string>>(serviceName: string): T;
    public getService(serviceName: string): Service<any, string> {
        if (this.services.has(serviceName)) {
            return this.services.get(serviceName)!;
        }

        let service: Service<any, string>;
        switch (serviceName) {
            case 'host':
                service = new HostService(this);
                break;
            default:
                throw new Error(`Unknown service: ${serviceName}`);
        }

        this.services.set(serviceName, service);
        return service;
    }
}
