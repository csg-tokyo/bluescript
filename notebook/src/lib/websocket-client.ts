
export type EventMap = Record<string, (...args: any[]) => void>;

export class EventEmitter<TEvents extends EventMap> {
  private events: Map<keyof TEvents, Array<(...args: any[]) => void>> = new Map();

  public on<K extends keyof TEvents>(eventName: K, listener: TEvents[K]): void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    this.events.get(eventName)!.push(listener);
  }

  public off<K extends keyof TEvents>(eventName: K, listener?: TEvents[K]): void {
    if (!listener) {
        this.events.delete(eventName);
        return;
    }

    const listeners = this.events.get(eventName);
    if (listeners) {
      const newListeners = listeners.filter(
        (l) => l !== listener && (l as any).originalListener !== listener
      );
      
      if (newListeners.length > 0) {
        this.events.set(eventName, newListeners);
      } else {
        this.events.delete(eventName);
      }
    }
  }

  public emit<K extends keyof TEvents>(eventName: K, ...args: Parameters<TEvents[K]>): boolean {
    const listeners = this.events.get(eventName);
    if (!listeners || listeners.length === 0) {
      return false;
    }

    listeners.slice().forEach((listener) => {
      listener(...args);
    });
    return true;
  }

  public once<K extends keyof TEvents>(eventName: K, listener: TEvents[K]): void {
    const onceWrapper = (...args: Parameters<TEvents[K]>) => {
      listener(...args);
      this.off(eventName, onceWrapper as TEvents[K]);
    };
    
    (onceWrapper as any).originalListener = listener;

    this.on(eventName, onceWrapper as TEvents[K]);
  }
}

export interface WebSocketMessage {
    service: string;
    event: string;
    payload: any[];
}

export abstract class Service<TEvents extends EventMap> extends EventEmitter<TEvents> {
    constructor(
        public readonly serviceName: string,
        protected readonly client: WebSocketClient
    ) {
        super();
    }

    handleMessage<U extends keyof TEvents>(event: U, payload: Parameters<TEvents[U]>): void {
        this.emit(event, ...payload);
    }

    protected send(event: string, payload: any[]): void {
        this.client.send({
            service: this.serviceName,
            event,
            payload
        });
    }
}

export type ReplServiceEvents = {
    finishCompilation: (time: number, error?: string) => void;
    finishLoading: (time: number) => void;
    finishExecution: (time: number) => void;
    log: (log: string) => void;
    error: (error: string) => void;
}

export class ReplService extends Service<ReplServiceEvents> {
    constructor(client: WebSocketClient) {
        super('repl', client);
    }

    public execute(code: string): void {
        this.send('execute', [ code ]);
    }
}

export type WebSocketClientEvents = {
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
                // if (this.ws?.readyState !== WebSocket.OPEN) {
                //     reject(new Error(`Failed to connect ${url}: ${error}`));
                // }
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