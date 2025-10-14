import { ConnectionMessage } from '../../src/services/common';
import { WebSocketConnection } from '../../src/services/websocket';
import { WebSocket } from 'ws';


describe('WebSocketConnection', () => {
    const PORT = 8081;
    const URL = `ws://localhost:${PORT}`;
    let connection: WebSocketConnection;
    

    beforeEach(() => {
        connection = new WebSocketConnection(PORT);
    });

    afterEach(() => {
        connection.close();
    });
    
    it('should open and emit a "connected" event', async () => {
        const connectedListener = jest.fn();
        connection.on('connected', connectedListener);

        connection.open();
        const client = new WebSocket(URL);
        await new Promise<void>((resolve) => {
          client.onopen = () => {
            resolve();
          }
        });

        expect(connectedListener).toHaveBeenCalledTimes(1);
        client.close();
        await new Promise<void>((resolve) => {client.close = () => {resolve()}});
    });

    it('should emit a "disconnected" event', async () => {
        const disconnectedListener = jest.fn();
        connection.on('disconnected', disconnectedListener);

        connection.open();
        const client = new WebSocket(URL);
        await new Promise<void>((resolve) => {
          client.onopen = () => {
            resolve();
          }
        });
        client.close();
        await new Promise<void>((resolve) => {
          setTimeout(() => {resolve()}, 50);
        });

        expect(disconnectedListener).toHaveBeenCalledTimes(1);
    });
});


describe('REPL Service', () => {
    const PORT = 8081;
    const URL = `ws://localhost:${PORT}`;
    let connection: WebSocketConnection;
    let client: WebSocket;

    beforeEach(async () => {
        connection = new WebSocketConnection(PORT);
        connection.open();
        client = new WebSocket(URL);
        await new Promise<void>((resolve) => {
          client.onopen = () => {
            resolve();
          }
        });
    });

    afterEach(async () => {
        connection.close();
        client.close();
        await new Promise<void>((resolve) => {client.close = () => {resolve()}});
    });

    it('should send finishCompilation event.', async () => {
        const replService = connection.getService('repl');
        await replService.finishCompilation(124);
        const message = await new Promise<ConnectionMessage<any>>((resolve) => {
          client.onmessage = (event) => {
            resolve(JSON.parse(event.data as string) as ConnectionMessage<any>);
          }
        });
        expect(message.service).toBe('repl');
        expect(message.event).toBe('finishCompilation');
        expect(message.payload[0]).toBe(124);
        expect(message.payload[1]).toBe(null);
    });

    it('should send finishCompilation event with compile error.', async () => {
        const replService = connection.getService('repl');
        await replService.finishCompilation(124, 'Compile Error');
        const message = await new Promise<ConnectionMessage<any>>((resolve) => {
          client.onmessage = (event) => {
            resolve(JSON.parse(event.data as string) as ConnectionMessage<any>);
          }
        });
        expect(message.service).toBe('repl');
        expect(message.event).toBe('finishCompilation');
        expect(message.payload[0]).toBe(124);
        expect(message.payload[1]).toBe('Compile Error');
    });

    it('should send finishSending event.', async () => {
        const replService = connection.getService('repl');
        await replService.finishSending(124);
        const message = await new Promise<ConnectionMessage<any>>((resolve) => {
          client.onmessage = (event) => {
            resolve(JSON.parse(event.data as string) as ConnectionMessage<any>);
          }
        });
        expect(message.service).toBe('repl');
        expect(message.event).toBe('finishSending');
        expect(message.payload[0]).toBe(124);
    });

    it('should send finishExecution event.', async () => {
        const replService = connection.getService('repl');
        await replService.finishExecution(124);
        const message = await new Promise<ConnectionMessage<any>>((resolve) => {
          client.onmessage = (event) => {
            resolve(JSON.parse(event.data as string) as ConnectionMessage<any>);
          }
        });
        expect(message.service).toBe('repl');
        expect(message.event).toBe('finishExecution');
        expect(message.payload[0]).toBe(124);
    });

    it('should send log event.', async () => {
        const replService = connection.getService('repl');
        await replService.log('Hello world!');
        const message = await new Promise<ConnectionMessage<any>>((resolve) => {
          client.onmessage = (event) => {
            resolve(JSON.parse(event.data as string) as ConnectionMessage<any>);
          }
        });
        expect(message.service).toBe('repl');
        expect(message.event).toBe('log');
        expect(message.payload[0]).toBe('Hello world!');
    });

    it('should send error event.', async () => {
        const replService = connection.getService('repl');
        await replService.error('I am error.');
        const message = await new Promise<ConnectionMessage<any>>((resolve) => {
          client.onmessage = (event) => {
            resolve(JSON.parse(event.data as string) as ConnectionMessage<any>);
          }
        });
        expect(message.service).toBe('repl');
        expect(message.event).toBe('error');
        expect(message.payload[0]).toBe('I am error.');
    });

    it('should receive execution event.', async () => {
        const replService = connection.getService('repl');
        const executeListener = jest.fn();
        replService.on('execute', executeListener);

        client.send(JSON.stringify({
              service: 'repl',
              event: 'execute',
              payload: ['1 + 1;']
        }));
        await new Promise<void>((resolve) => {
          setTimeout(() => {resolve()}, 50);
        });

        expect(executeListener).toHaveBeenCalledWith("1 + 1;");
    });
})