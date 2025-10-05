import { BytecodeBufferGenerator, bytecodeParser, BYTECODE } from '../../src/cli/bytecode';
import { MemoryLayout } from "@bluescript/compiler";
import { beforeEach, describe, expect, it } from '@jest/globals';

const FIRST_HEADER = Buffer.from([0x03, 0x00]);
const LOAD_HEADER_SIZE = 9;

describe('BytecodeBufferGenerator', () => {
    let generator: BytecodeBufferGenerator;
    const unitSize = 32;

    beforeEach(() => {
        generator = new BytecodeBufferGenerator(unitSize);
    });

    it('should correctly reset its state after generate() is called', () => {
        generator.reset();
        const units1 = generator.generate();
        expect(units1).toHaveLength(1);

        generator.reset();
        const units2 = generator.generate();
        expect(units2).toHaveLength(1);
    });

    it('should add a RESET command within the current unit', () => {
        const units = generator.reset().generate();
        expect(units).toHaveLength(1);
        expect(units[0]).toEqual(Buffer.concat([FIRST_HEADER, Buffer.from([BYTECODE.RESET])]));
    });

    it('should add a JUMP command within the current unit', () => {
        const id = 123;
        const address = 0x80004000;
        const units = generator.jump(id, address).generate();

        const expectedHeader = Buffer.alloc(9);
        expectedHeader.writeUInt8(BYTECODE.JUMP, 0);
        expectedHeader.writeInt32LE(id, 1);
        expectedHeader.writeUInt32LE(address, 5);

        expect(units).toHaveLength(1);
        expect(units[0]).toEqual(Buffer.concat([FIRST_HEADER, expectedHeader]));
    });

    describe('load() method', () => {
        it('should load small data that fits into a single unit', () => {
            const address = 0x1000;
            const data = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]);
            const units = generator.load(address, data).generate();

            const loadHeader = Buffer.alloc(LOAD_HEADER_SIZE);
            loadHeader.writeUInt8(BYTECODE.LOAD, 0);
            loadHeader.writeUInt32LE(address, 1);
            loadHeader.writeUInt32LE(data.length, 5);

            expect(units).toHaveLength(1);
            expect(units[0]).toEqual(Buffer.concat([FIRST_HEADER, loadHeader, data]));
        });

        it('should load small data (size is not 4 byte align) that fits into a single unit', () => {
            const address = 0x1000;
            const data = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]);
            const units = generator.load(address, data).generate();

            const loadHeader = Buffer.alloc(LOAD_HEADER_SIZE);
            loadHeader.writeUInt8(BYTECODE.LOAD, 0);
            loadHeader.writeUInt32LE(address, 1);
            loadHeader.writeUInt32LE(data.length, 5);

            expect(units).toHaveLength(1);
            expect(units[0]).toEqual(Buffer.concat([FIRST_HEADER, loadHeader, data]));
        });

        it('should split large data across multiple units', () => {
            const address = 0x2000;
            const dataSize1 = 20;
            const dataSize2 = 13;
            const data = Buffer.alloc(dataSize1 + dataSize2, 0xEE);

            const units = generator.load(address, data).generate();

            expect(units).toHaveLength(2);

            const loadHeader1 = Buffer.alloc(LOAD_HEADER_SIZE);
            loadHeader1.writeUInt8(BYTECODE.LOAD, 0);
            loadHeader1.writeUInt32LE(address, 1);
            loadHeader1.writeUInt32LE(dataSize1, 5);
            const expectedUnit1 = Buffer.concat([FIRST_HEADER, loadHeader1, data.subarray(0, dataSize1)]);
            expect(units[0]).toEqual(expectedUnit1);


            const loadHeader2 = Buffer.alloc(LOAD_HEADER_SIZE);
            loadHeader2.writeUInt8(BYTECODE.LOAD, 0);
            loadHeader2.writeUInt32LE(address + dataSize1, 1);
            loadHeader2.writeUInt32LE(dataSize2, 5);
            const expectedUnit2 = Buffer.concat([FIRST_HEADER, loadHeader2, data.subarray(dataSize1)]);
            expect(units[1]).toEqual(expectedUnit2);
        });
    });

    it('should chain commands correctly', () => {
        const loadAddress = 0x1000;
        const loadData = Buffer.from([1, 2, 3, 4]);
        const jumpId = 99;
        const jumpAddress = 0x4000;

        const units = generator
            .load(loadAddress, loadData)
            .jump(jumpId, jumpAddress)
            .reset()
            .generate();

        const loadHeader = Buffer.alloc(LOAD_HEADER_SIZE);
        loadHeader.writeUInt8(BYTECODE.LOAD, 0);
        loadHeader.writeUInt32LE(loadAddress, 1);
        loadHeader.writeUInt32LE(loadData.length, 5);

        const jumpHeader = Buffer.alloc(9);
        jumpHeader.writeUInt8(BYTECODE.JUMP, 0);
        jumpHeader.writeInt32LE(jumpId, 1);
        jumpHeader.writeUInt32LE(jumpAddress, 5);

        const resetHeader = Buffer.from([BYTECODE.RESET]);

        const expectedBuffer = Buffer.concat([FIRST_HEADER, loadHeader, loadData, jumpHeader, resetHeader]);

        expect(units).toHaveLength(1);
        expect(units[0]).toEqual(expectedBuffer);
    });
});

describe('bytecodeParser', () => {
    it('should parse RESULT_LOG', () => {
        const logMessage = "Hello, World!";
        const buffer = Buffer.concat([Buffer.from([BYTECODE.RESULT_LOG]), Buffer.from(logMessage, 'utf-8'), Buffer.from([0])]);
        const result = bytecodeParser(buffer);

        expect(result.bytecode).toBe(BYTECODE.RESULT_LOG);
        if (result.bytecode === BYTECODE.RESULT_LOG) {
            expect(result.log).toBe(logMessage);
        }
    });

    it('should parse RESULT_ERROR', () => {
        const errorMessage = "An error occurred.";
        const buffer = Buffer.concat([Buffer.from([BYTECODE.RESULT_ERROR]), Buffer.from(errorMessage, 'utf-8')]);
        const result = bytecodeParser(buffer);

        expect(result.bytecode).toBe(BYTECODE.RESULT_ERROR);
        if (result.bytecode === BYTECODE.RESULT_ERROR) {
            expect(result.error).toBe(errorMessage);
        }
    });

    it('should parse RESULT_MEMINFO', () => {
        const buffer = Buffer.alloc(1 + 4 * 8);
        buffer.writeUInt8(BYTECODE.RESULT_MEMINFO, 0);
        let offset = 1;
        buffer.writeUInt32LE(0x1000, offset); offset += 4;
        buffer.writeUInt32LE(0x100, offset);  offset += 4; // iram
        buffer.writeUInt32LE(0x2000, offset); offset += 4;
        buffer.writeUInt32LE(0x200, offset);  offset += 4; // dram
        buffer.writeUInt32LE(0x3000, offset); offset += 4;
        buffer.writeUInt32LE(0x300, offset);  offset += 4; // iflash
        buffer.writeUInt32LE(0x4000, offset); offset += 4;
        buffer.writeUInt32LE(0x400, offset);  offset += 4; // dflash

        const result = bytecodeParser(buffer);

        expect(result.bytecode).toBe(BYTECODE.RESULT_MEMINFO);
        if (result.bytecode === BYTECODE.RESULT_MEMINFO) {
            const expected: MemoryLayout = {
                iram: { address: 0x1000, size: 0x100 },
                dram: { address: 0x2000, size: 0x200 },
                iflash: { address: 0x3000, size: 0x300 },
                dflash: { address: 0x4000, size: 0x400 },
            };
            expect(result.meminfo).toEqual(expected);
        }
    });

    it('should parse RESULT_EXECTIME', () => {
        const buffer = Buffer.alloc(1 + 4 + 4);
        const id = -1; // signed int
        const exectime = 123.456;
        buffer.writeUInt8(BYTECODE.RESULT_EXECTIME, 0);
        buffer.writeInt32LE(id, 1);
        buffer.writeFloatLE(exectime, 5);

        const result = bytecodeParser(buffer);

        expect(result.bytecode).toBe(BYTECODE.RESULT_EXECTIME);
        if (result.bytecode === BYTECODE.RESULT_EXECTIME) {
            expect(result.id).toBe(id);
            expect(result.exectime).toBeCloseTo(exectime, 3);
        }
    });

    it('should parse RESULT_PROFILE', () => {
        const fid = 42;
        const params = "integer, float, void";
        const buffer = Buffer.concat([
            Buffer.from([BYTECODE.RESULT_PROFILE, fid]),
            Buffer.from(params, 'utf-8'),
            Buffer.from([0])
        ]);
        const result = bytecodeParser(buffer);

        expect(result.bytecode).toBe(BYTECODE.RESULT_PROFILE);
        if (result.bytecode === BYTECODE.RESULT_PROFILE) {
            expect(result.fid).toBe(fid);
            expect(result.paramtypes).toEqual(["integer", "float", "void"]);
        }
    });

    it('should return NONE for unknown bytecode', () => {
        const buffer = Buffer.from([0xFF, 0x01, 0x02]);
        const result = bytecodeParser(buffer);
        expect(result.bytecode).toBe(BYTECODE.NONE);
    });

    it('should return NONE for an empty buffer', () => {
        const buffer = Buffer.from([]);
        const result = bytecodeParser(buffer);
        expect(result.bytecode).toBe(BYTECODE.NONE);
    });
});