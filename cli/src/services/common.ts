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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            eventListeners.forEach(listener => (listener as any)(...args));
        }
    }
}

export interface ConnectionMessage<T> {
    service: string;
    event: string;
    payload: T[];
}

export abstract class Service<T extends object, K> extends EventEmitter<T> {
    constructor(
        public readonly serviceName: string,
        protected readonly connection: Connection<K>
    ) {
        super();
    }

    handleMessage(event: string, payload: any[]): void {
        (this.emit as any)(event, ...payload);
    }

    protected async send(event: string, payload: K[]): Promise<void> {
        await this.connection.send({
            service: this.serviceName,
            event,
            payload
        });
    }
}

export interface ConnectionEvents {
    connected: () => void;
    disconnected: (event: any) => void;
    error: (error: Error) => void;
}

export abstract class Connection<T> extends EventEmitter<ConnectionEvents> {
    abstract send(message: ConnectionMessage<T>): Promise<void>;
    abstract getService<K extends Service<object, T>>(serviceName: string): K;
}