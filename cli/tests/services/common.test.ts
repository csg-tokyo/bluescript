import { EventEmitter } from "../../src/services/common";


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

