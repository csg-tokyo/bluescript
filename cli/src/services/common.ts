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


export interface ConnectionMessage<T> {
    service: string;
    event: string;
    payload: T[];
}

export abstract class Service<TEvents extends EventMap, K> extends EventEmitter<TEvents> {
    constructor(
        public readonly serviceName: string,
        protected readonly connection: Connection<K>
    ) {
        super();
    }

    handleMessage<U extends keyof TEvents>(event: U, payload: Parameters<TEvents[U]>): void {
        this.emit(event, ...payload);
    }

    protected async send(event: string, payload: K[]): Promise<void> {
        await this.connection.send({
            service: this.serviceName,
            event,
            payload
        });
    }
}

export type ConnectionEvents = {
    connected: () => void;
    disconnected: (event: any) => void;
    error: (error: Error) => void;
}

export abstract class Connection<T> extends EventEmitter<ConnectionEvents> {
    abstract send(message: ConnectionMessage<T>): Promise<void>;
    abstract getService<K extends Service<EventMap, T>>(serviceName: string): K;
}