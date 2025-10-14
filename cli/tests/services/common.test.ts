import { EventEmitter } from "../../src/services/common";


interface TestEvents {
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
        (emitter as any).emit('hello', 'world'); 

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith('world');
    });

    it('should trigger multiple listeners for the same event', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        emitter.on('data', listener1);
        emitter.on('data', listener2);
        (emitter as any).emit('data', 123, true);

        expect(listener1).toHaveBeenCalledWith(123, true);
        expect(listener2).toHaveBeenCalledWith(123, true);
    });

    it('should remove a specific listener', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        emitter.on('goodbye', listener1);
        emitter.on('goodbye', listener2);
        
        emitter.off('goodbye', listener1);
        (emitter as any).emit('goodbye');

        expect(listener1).not.toHaveBeenCalled();
        expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for an event if no listener is specified', () => {
        const listener = jest.fn();
        emitter.on('hello', listener);
        emitter.off('hello');
        (emitter as any).emit('hello', 'test');
        
        expect(listener).not.toHaveBeenCalled();
    });

    it('should not throw an error when emitting an event with no listeners', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        expect(() => (emitter as any).emit('hello', 'nobody')).not.toThrow();
    });
});

