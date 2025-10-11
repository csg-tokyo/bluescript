
export class EventEmitter<T extends object> {
    private listeners: { [K in keyof T]?: Array<T[K]> } = {};

    on<K extends keyof T>(eventName: K, listener: T[K]): void {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName]!.push(listener);
    }

    off<K extends keyof T>(eventName: K, listener?: T[K]): void {
        const eventListeners = this.listeners[eventName];
        if (!eventListeners) {
            return;
        }
        if (!listener) {
            delete this.listeners[eventName];
            return;
        }
        this.listeners[eventName] = eventListeners.filter(l => l !== listener);
    }

    protected emit<K extends keyof T>(eventName: K, ...args: any[]): void {
        const eventListeners = this.listeners[eventName];
        if (eventListeners) {
            eventListeners.forEach(listener => (listener as any)(...args));
        }
    }
}

export interface WebSocketMessage {
    service: string;
    event: string;
    payload: any;
}

export abstract class Service<T extends object> extends EventEmitter<T> {
    constructor(
        public readonly serviceName: string,
        protected readonly client: WebSocketClient
    ) {
        super();
    }

    handleMessage(event: string, payload: any): void {
        (this.emit as any)(event, payload);
    }

    protected send(event: string, payload: any): void {
        this.client.send({
            service: this.serviceName,
            event,
            payload
        });
    }
}

export interface ReplServiceEvents {
    finishCompilation: (time: number, error?: string) => void;
    finishSending: (time: number) => void;
    finishExecution: (time: number) => void;
    log: (log: string) => void;
    error: (error: string) => void;
}

export class ReplService extends Service<ReplServiceEvents> {
    constructor(client: WebSocketClient) {
        super('repl', client);
    }

    public execute(code: string): void {
        this.send('execute', { code });
    }
}

export interface WebSocketClientEvents {
    connected: () => void;
    disconnected: (event: CloseEvent) => void;
    error: (error: Event) => void;
}

export class WebSocketClient extends EventEmitter<WebSocketClientEvents> {
    private ws: WebSocket | null = null;
    private services: Map<string, Service<any>> = new Map();

    public connect(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                return resolve();
            }

            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.emit('connected');
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    const service = this.services.get(message.service);
                    if (service) {
                        service.handleMessage(message.event, message.payload);
                    } else {
                        console.warn(`Service "${message.service}" not found.`);
                    }
                } catch (error) {
                    console.error("Failed to parse message:", event.data, error);
                }
            };

            this.ws.onclose = (event) => {
                this.emit('disconnected', event);
                this.ws = null;
            };

            this.ws.onerror = (error) => {
                this.emit('error', error);
                if (this.ws?.readyState !== WebSocket.OPEN) {
                    reject(new Error());
                }
            };
        });
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
        }
    }

    public send(message: WebSocketMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error("WebSocket is not connected.");
        }
    }
    
    public getService(serviceName: 'repl'): ReplService;
    public getService<T extends Service<any>>(serviceName: string): T;
    public getService(serviceName: string): Service<any> {
        if (this.services.has(serviceName)) {
            return this.services.get(serviceName)!;
        }

        let service: Service<any>;
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