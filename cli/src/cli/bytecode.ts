import { MemoryLayout } from "../compiler/compiler";

export enum BYTECODE {
    NONE,
    LOAD,
    JUMP,
    RESET,
    RESULT_LOG,
    RESULT_ERROR,
    RESULT_MEMINFO,
    RESULT_EXECTIME,
    RESULT_PROFILE
}

// Headers
const FIRST_HEADER_SIZE = 2;
const FIRST_HEADER = Buffer.from([0x03, 0x00]);

// Command sizes
const LOAD_HEADER_SIZE = 9;   // cmd(1) + address(4) + size(4)
const JUMP_HEADER_SIZE = 9;   // cmd(1) + id(4) + address(4)
const RESET_HEADER_SIZE = 1;  // cmd(1)

export class BytecodeBufferGenerator {
    private readonly unitSize: number;
    private units: Buffer[] = [];
    private lastUnit: Buffer;
    private lastUnitRemain: number;

    constructor(unitSize: number, useFirstHeader = true) {
        if (useFirstHeader) {
            this.unitSize = unitSize - FIRST_HEADER_SIZE;
            this.lastUnit = Buffer.from(FIRST_HEADER);
        } else {
            this.unitSize = unitSize;
            this.lastUnit = Buffer.from([]);
        }
        this.lastUnitRemain = this.unitSize;
    }

    private _flushUnit() {
        if (this.lastUnit.length > FIRST_HEADER_SIZE) {
            this.units.push(this.lastUnit);
        }
        this.lastUnit = Buffer.from(FIRST_HEADER);
        this.lastUnitRemain = this.unitSize;
    }

    private _appendToCurrentUnit(data: Buffer) {
        this.lastUnit = Buffer.concat([this.lastUnit, data]);
        this.lastUnitRemain -= data.length;
    }

    private _createLoadHeader(loadCmd: number, address: number, size: number) {
        const header = Buffer.allocUnsafe(LOAD_HEADER_SIZE);
        header.writeUInt8(loadCmd, 0);       // cmd(1)
        header.writeUInt32LE(address, 1);    // address(4)
        header.writeUInt32LE(size, 5);       // size(4)
        return header;
    }

    private _appendCommand(commandData: Buffer) {
        if (commandData.length > this.lastUnitRemain) {
            this._flushUnit();
        }
        this._appendToCurrentUnit(commandData);
        return this;
    }

    public load(address: number, data: Buffer) {
        let dataOffset = 0;
        let currentAddress = address;

        while (dataOffset < data.length) {
            if (this.lastUnitRemain < LOAD_HEADER_SIZE) {
                this._flushUnit();
            }

            const dataRemain = data.length - dataOffset;
            const availableSpaceForData = (this.lastUnitRemain - LOAD_HEADER_SIZE) & ~0b11; // 4 byte align

            let chunkSize = Math.min(dataRemain, availableSpaceForData);
            if (chunkSize <= 0) {
                this._flushUnit();
                continue;
            }

            const header = this._createLoadHeader(BYTECODE.LOAD, currentAddress, chunkSize);
            const chunk = data.subarray(dataOffset, dataOffset + chunkSize);

            this._appendToCurrentUnit(header);
            this._appendToCurrentUnit(chunk);

            dataOffset += chunkSize;
            currentAddress += chunkSize;
        }
        return this;
    }

    public jump(id: number, address: number) {
        const header = Buffer.allocUnsafe(JUMP_HEADER_SIZE);
        header.writeUInt8(BYTECODE.JUMP, 0);     // cmd(1)
        header.writeInt32LE(id, 1);              // id(4)
        header.writeUInt32LE(address, 5);        // address(4)
        return this._appendCommand(header);
    }

    public reset() {
        const header = Buffer.from([BYTECODE.RESET]);
        return this._appendCommand(header);
    }

    public generate(): Buffer[] {
        if (this.lastUnit.length > FIRST_HEADER_SIZE) {
            this.units.push(this.lastUnit);
        }
        const result = this.units;

        // Reset state
        this.units = [];
        this.lastUnit = Buffer.from(FIRST_HEADER);
        this.lastUnitRemain = this.unitSize;

        return result;
    }
}


export type ParseResult =
    {bytecode:BYTECODE.RESULT_LOG, log:string} |
    {bytecode:BYTECODE.RESULT_ERROR, error:string} |
    {bytecode:BYTECODE.RESULT_MEMINFO, meminfo:MemoryLayout} |
    {bytecode:BYTECODE.RESULT_EXECTIME, id: number, exectime:number} |
    {bytecode:BYTECODE.RESULT_PROFILE, fid:number, paramtypes:string[]} |
    {bytecode:BYTECODE.NONE};

const textDecoder = new TextDecoder();

export function bytecodeParser(buffer: Buffer): ParseResult {
    if (buffer.length === 0) {
        return { bytecode: BYTECODE.NONE };
    }

    const bytecode = buffer.readUInt8(0);
    let offset = 1;

    switch (bytecode) {
        case BYTECODE.RESULT_LOG: {
            const end = buffer[buffer.length - 1] === 0 ? buffer.length - 1 : buffer.length;
            const log = buffer.toString('utf-8', offset, end);
            return { bytecode, log };
        }
        case BYTECODE.RESULT_ERROR: {
            const end = buffer[buffer.length - 1] === 0 ? buffer.length - 1 : buffer.length;
            const error = buffer.toString('utf-8', offset, end);
            return { bytecode, error };
        }
        case BYTECODE.RESULT_MEMINFO: {
            const readMemInfo = () => {
                const address = buffer.readUInt32LE(offset); offset += 4;
                const size = buffer.readUInt32LE(offset); offset += 4;
                return { address, size };
            };
            const meminfo = {
                iram: readMemInfo(),
                dram: readMemInfo(),
                iflash: readMemInfo(),
                dflash: readMemInfo(),
            };
            return { bytecode, meminfo };
        }
        case BYTECODE.RESULT_EXECTIME: {
            const id = buffer.readInt32LE(offset); offset += 4;
            const exectime = buffer.readFloatLE(offset); offset += 4;
            return { bytecode, id, exectime };
        }
        case BYTECODE.RESULT_PROFILE: {
            const fid = buffer.readUInt8(offset); offset += 1;
            const paramStr = textDecoder.decode(buffer.subarray(offset, buffer.length - 1));
            return { bytecode, fid, paramtypes: paramStr ? paramStr.split(", ") : [] };
        }
        default:
            return { bytecode: BYTECODE.NONE };
    }
}