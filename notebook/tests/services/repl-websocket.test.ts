import { EventEmitter, WebSocketClient } from '../../src/lib/websocket-client';
import { Client, Server, WebSocket } from 'mock-socket';

(global as any).WebSocket = WebSocket;


type TestEvents = {
    hello: (name: string) => void;
    goodbye: () => void;
    data: (a: number, b: boolean) => void;
}

describe('EventEmitter', () => {
    let emitter: EventEmitter<TestEvents>;

    beforeEach(() => {
        emitter = new EventEmitter<TestEvents>();
    });

    it('should register and trigger a listener', () => {
        const listener = jest.fn();
        emitter.on('hello', listener);
        emitter.emit('hello', 'world'); 

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith('world');
    });

    it('should trigger a listener registered with once only once', () => {
        const listener = jest.fn();
        emitter.once('hello', listener);
        emitter.emit('hello', 'world');
        emitter.emit('hello', 'world');

        expect(listener).toHaveBeenCalledTimes(1);
    })

    it('should trigger multiple listeners for the same event', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        emitter.on('data', listener1);
        emitter.on('data', listener2);
        emitter.emit('data', 123, true);

        expect(listener1).toHaveBeenCalledWith(123, true);
        expect(listener2).toHaveBeenCalledWith(123, true);
    });

    it('should remove a specific listener', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        emitter.on('goodbye', listener1);
        emitter.on('goodbye', listener2);
        
        emitter.off('goodbye', listener1);
        emitter.emit('goodbye');

        expect(listener1).not.toHaveBeenCalled();
        expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for an event if no listener is specified', () => {
        const listener = jest.fn();
        emitter.on('hello', listener);
        emitter.off('hello');
        emitter.emit('hello', 'test');
        
        expect(listener).not.toHaveBeenCalled();
    });

    it('should not throw an error when emitting an event with no listeners', () => {
        expect(() => emitter .emit('hello', 'nobody')).not.toThrow();
    });
});


describe('WebSocketClient and ReplService integration', () => {
    let mockServer: Server;
    let wsc: WebSocketClient;
    const FAKE_URL = 'ws://localhost:8080';

    beforeEach(() => {
        mockServer = new Server(FAKE_URL);
        wsc = new WebSocketClient();
    });

    afterEach(() => {
        mockServer.stop();
    });

    it('should connect and emit a "connected" event', async () => {
        const connectedListener = jest.fn();
        wsc.on('connected', connectedListener);

        await wsc.connect(FAKE_URL);

        expect(connectedListener).toHaveBeenCalledTimes(1);
    });

    it.skip('should handle connection errors', async () => {
        const errorListener = jest.fn();
        wsc.on('error', errorListener);
        
        mockServer.stop();

        await expect(wsc.connect(FAKE_URL)).rejects.toThrow();
        expect(errorListener).toHaveBeenCalledTimes(1);
    });

    it('should disconnect and emit a "disconnected" event', async () => {
        const disconnectedListener = jest.fn();
        wsc.on('disconnected', disconnectedListener);

        await wsc.connect(FAKE_URL);
        wsc.disconnect();

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(disconnectedListener).toHaveBeenCalledTimes(1);
        const closeEvent = disconnectedListener.mock.calls[0][0];
        expect(closeEvent.code).toBe(1005);
    });

    it('should get a service and cache it', () => {
        const repl1 = wsc.getService('repl');
        const repl2 = wsc.getService('repl');

        expect(repl1).toBeInstanceOf(Object);
        expect(repl1).toBe(repl2);
    });

    it('should throw an error for an unknown service', () => {
        expect(() => wsc.getService('unknown-service' as any)).toThrow('Unknown service: unknown-service');
    });
});


describe('REPL Service', () => {
    let serverSocket: Client;
    let mockServer: Server;
    let wsc: WebSocketClient;
    const FAKE_URL = 'ws://localhost:8080';

    afterEach(() => {
        mockServer.stop();
    });

    beforeEach(async () => {
        mockServer = new Server(FAKE_URL);
        wsc = new WebSocketClient();
        mockServer.on('connection', socket => {
            serverSocket = socket;
        })
        await wsc.connect(FAKE_URL);
    });

    it('should send a message when a service method is called', (done) => {  
        let receivedMessage: object;  
        serverSocket.on('message', data => {
            receivedMessage = JSON.parse(data.toString());
        });

        const repl = wsc.getService('repl');
        repl.execute('console.log("test")');

        setTimeout(() => {
            expect(receivedMessage).toEqual({
                service: 'repl',
                event: 'execute',
                payload: ['console.log("test")'],
            });
            done();
        }, 50);
    }, 100);

    it('should receive a message and dispatch it to the correct service', (done) => {
        const repl = wsc.getService('repl');
        const logListener = jest.fn();
        repl.on('log', logListener);

        mockServer.clients()[0].send(JSON.stringify({
            service: 'repl',
            event: 'log',
            payload: ['Hello world!'],
        }));

        setTimeout(() => {
            expect(logListener).toHaveBeenCalledTimes(1);
            expect(logListener).toHaveBeenCalledWith('Hello world!');
            done();
        }, 50);
    }, 100);

    it('should warn when a message for a non-existent service is received', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        mockServer.clients()[0].send(JSON.stringify({
            service: 'chat',
            event: 'newMessage',
            payload: ['Hi'],
        }));

        expect(consoleWarnSpy).toHaveBeenCalledWith('Service "chat" not found.');
        consoleWarnSpy.mockRestore();
    });
})