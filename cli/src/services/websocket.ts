import { Connection, ConnectionMessage, EventMap, Service } from "./common";
import { WebSocketServer, WebSocket } from 'ws';

export type ReplServiceEvents = {
    execute: (code: string) => void;
}

export class ReplService extends Service<ReplServiceEvents, any> {
    constructor(connection: WebSocketConnection) {
        super('repl', connection);
    }

    public async finishCompilation(time: number, error?: string) {
        await this.send('finishCompilation', [ time, error ]);
    };

    public async finishLoading(time: number) {
        await this.send('finishLoading', [ time ]);
    };

    public async finishExecution(time: number) {
        await this.send('finishExecution', [ time ]);
    };

    public async log(log: string) {
        await this.send('log', [ log ]);
    };

    public async error(error: string) {
        await this.send('error', [ error ]);
    };
}


export class WebSocketConnection extends Connection<any> {
    private port: number;
    private server: WebSocketServer | null = null;
    private client: WebSocket | null = null; // Only one clietn is allowed.
    private services: Map<string, Service<EventMap, any>> = new Map();

    constructor(port: number) {
        super();
        this.port = port;
    }

    public open() {
        this.server = new WebSocketServer({port: this.port});
        this.server.on('connection', (client: WebSocket) => {
            this.client = client;
            this.emit('connected');
            
            client.on('message', (message: Buffer) => {
                try {
                    const parsedMessage = JSON.parse(message.toString('utf-8')) as ConnectionMessage<any>;
                    const service = this.services.get(parsedMessage.service);
                    if (service) {
                        service.handleMessage(parsedMessage.event, parsedMessage.payload);
                    } else {
                        console.warn(`Service "${parsedMessage.service}" not found.`);
                    }
                } catch (error) {
                    console.error("Failed to parse message:", message, error);
                }
            });

            client.on('close', (event) => {
                this.emit('disconnected', event);
                this.client = null;
            });

            client.on('error', (error) => {
                this.emit('error', error);
            })
        });

    }

    public close(): void {
        if(this.server) {
            this.server.close();
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async send(message: ConnectionMessage<any>): Promise<void> {
        if (this.client && this.client.readyState === WebSocket.OPEN) {
            this.client.send(JSON.stringify(message));
        } else {
            console.error("WebSocket is not connected.");
        }
    }
    
    public getService(serviceName: 'repl'): ReplService;
    public getService<T extends Service<EventMap, any>>(serviceName: string): T;
    public getService(serviceName: string): Service<EventMap, any> {
        if (this.services.has(serviceName)) {
            return this.services.get(serviceName)!;
        }

        let service: Service<EventMap, any>;
        switch (serviceName) {
            case 'repl':
                service = new ReplService(this);
                break;
            default:
                throw new Error(`Unknown service: ${serviceName}`);
        }

        this.services.set(serviceName, service);
        return service;
    }
}