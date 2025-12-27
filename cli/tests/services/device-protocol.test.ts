import { ProtocolPacketBuilder, Protocol } from '../../src/services/device-protocol'


const BUFFER_SIZE =  17;

describe('ProtocolPacketBuilder', () => {
    test('should add jump command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.jump(1, 0x1234);
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Jump,
            0x01, 0x00, 0x00, 0x00, // id
            0x34, 0x12, 0x00, 0x00, // address
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should add reset command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.reset();
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Reset,
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should add short load command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.load(0x1234, Buffer.from([0x00, 0x01, 0x02, 0x03]));
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x34, 0x12, 0x00, 0x00, // address
            0x04, 0x00, 0x00, 0x00, // size
            0x00, 0x01, 0x02, 0x03, // data
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should add long load command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.load(0x1234, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
        const expectedBuffer1 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x34, 0x12, 0x00, 0x00, // address
            0x04, 0x00, 0x00, 0x00, // size
            0x00, 0x01, 0x02, 0x03, // data
        ]);
        const expectedBuffer2 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x38, 0x12, 0x00, 0x00, // address
            0x03, 0x00, 0x00, 0x00, // size
            0x04, 0x05, 0x06, // data
        ]);
        expect(builder.build()).toEqual([expectedBuffer1, expectedBuffer2]);
    });

    test('should add reset command after full load command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.load(0x1234, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
        builder.reset();
        const expectedBuffer1 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x34, 0x12, 0x00, 0x00, // address
            0x04, 0x00, 0x00, 0x00, // size
            0x00, 0x01, 0x02, 0x03, // data
        ]);
        const expectedBuffer2 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x38, 0x12, 0x00, 0x00, // address
            0x03, 0x00, 0x00, 0x00, // size
            0x04, 0x05, 0x06, // data
            Protocol.Reset,
        ]);
        expect(builder.build()).toEqual([expectedBuffer1, expectedBuffer2]);
    })
})