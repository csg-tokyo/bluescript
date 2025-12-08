import { Buffer } from "node:buffer";
import { MemoryLayout } from "@bluescript/lang";


export enum Protocol {
    None,
    Load,
    Jump,
    Reset,

    Log,
    Error,
    Memory,
    Exectime,
    Profile
}


// Headers
const FIRST_HEADER_SIZE = 2;
const FIRST_HEADER = Buffer.from([0x03, 0x00]);

// Command sizes
const LOAD_HEADER_SIZE = 9;   // cmd(1) + address(4) + size(4)
const JUMP_HEADER_SIZE = 9;   // cmd(1) + id(4) + address(4)
const RESET_HEADER_SIZE = 1;  // cmd(1)

const ALIGNMENT = 4;

export class ProtocolPacketBuilder {
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

    public build(): Buffer[] {
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

    public load(address: number, data: Buffer) {
        let dataOffset = 0;
        let currentAddress = address;

        while (dataOffset < data.length) {
            const dataRemain = data.length - dataOffset;
            const writtenBytes = this.loadChunk(currentAddress, data.subarray(dataOffset), dataRemain);
            
            if (writtenBytes <= 0) {
                this.flushUnit();
                if (this.loadChunk(currentAddress, data.subarray(dataOffset), dataRemain) <= 0) {
                    throw new Error("Failed to make progress in load method. Check data and unit sizes.");
                }
            }
            
            dataOffset += writtenBytes;
            currentAddress += writtenBytes;
        }
        return this;
    }

    private loadChunk(address: number, data: Buffer, dataRemain: number): number {
        if (this.lastUnitRemain < LOAD_HEADER_SIZE) {
            return 0;
        }

        const availableSpace = this.lastUnitRemain - LOAD_HEADER_SIZE;
        const alignedSpace = this.alignDown(availableSpace, ALIGNMENT);

        const chunkSize = Math.min(dataRemain, alignedSpace);

        if (chunkSize <= 0) {
            return 0;
        }
        
        const header = this.createLoadHeader(Protocol.Load, address, chunkSize);
        const chunk = data.subarray(0, chunkSize);

        this.appendToCurrentUnit(header);
        this.appendToCurrentUnit(chunk);

        return chunkSize;
    }

    private alignDown(value: number, alignment: number): number {
        return value & ~(alignment - 1);
    }

    private createLoadHeader(loadCmd: number, address: number, size: number) {
        const header = Buffer.allocUnsafe(LOAD_HEADER_SIZE);
        header.writeUInt8(loadCmd, 0);       // cmd(1)
        header.writeUInt32LE(address, 1);    // address(4)
        header.writeUInt32LE(size, 5);       // size(4)
        return header;
    }

    public jump(id: number, address: number) {
        const header = Buffer.allocUnsafe(JUMP_HEADER_SIZE);
        header.writeUInt8(Protocol.Jump, 0);     // cmd(1)
        header.writeInt32LE(id, 1);              // id(4)
        header.writeUInt32LE(address, 5);        // address(4)
        return this.appendCommand(header);
    }

    public reset() {
        const header = Buffer.allocUnsafe(RESET_HEADER_SIZE);
        header.writeUInt8(Protocol.Reset, 0);
        return this.appendCommand(header);
    }

    private appendCommand(commandData: Buffer) {
        if (commandData.length > this.lastUnitRemain) {
            this.flushUnit();
        }
        this.appendToCurrentUnit(commandData);
        return this;
    }

    private flushUnit() {
        if (this.lastUnit.length > FIRST_HEADER_SIZE) {
            this.units.push(this.lastUnit);
        }
        this.lastUnit = Buffer.from(FIRST_HEADER);
        this.lastUnitRemain = this.unitSize;
    }

    private appendToCurrentUnit(data: Buffer) {
        this.lastUnit = Buffer.concat([this.lastUnit, data]);
        this.lastUnitRemain -= data.length;
    }
}


type ProtocolPayloads = {
    [Protocol.None]: {};
    [Protocol.Load]: {};
    [Protocol.Jump]: {};
    [Protocol.Reset]: {};
    [Protocol.Log]: { log: string };
    [Protocol.Error]: { error: string };
    [Protocol.Memory]: { layout: MemoryLayout };
    [Protocol.Exectime]: { id: number; time: number };
    [Protocol.Profile]: { fid: number; paramtypes: string[] };
}

export type ParseResult<T extends Protocol = Protocol> = {
    [K in T]: { protocol: K } & ProtocolPayloads[K]
}[T];

type ParserFunction<K extends Protocol> = (buffer: Buffer, offset: number) => ProtocolPayloads[K];

export class ProtocolParser {
    private readonly parsers: {[K in Protocol]?: ParserFunction<K>};

    constructor() {
        this.parsers = {
            [Protocol.Log]: ProtocolParser.parseLog,
            [Protocol.Error]: ProtocolParser.parseError,
            [Protocol.Memory]: ProtocolParser.parseMemory,
            [Protocol.Exectime]: ProtocolParser.parseExectime,
            [Protocol.Profile]: ProtocolParser.parseProfile,
        }
    }

    public parse(buffer: Buffer): ParseResult {
        if (buffer.length === 0) {
            throw new Error('Failed to parse buffer. The buffer is empty.');
        }
        const protocol = buffer.readUInt8(0);
        if (!this.isParseableProtocol(protocol)) {
            throw new Error(`Failed to parse buffer. The protocol ${protocol} is not parsable.`);
        }
        const parser = this.parsers[protocol]!;
        const payload = parser(buffer, 1);
        return {protocol, ...payload} as ParseResult;
    }

    private isParseableProtocol(value: number): value is keyof typeof this.parsers {
        return value in this.parsers;
    }

    static parseLog(buffer: Buffer, offset: number): {log: string} {
        const end = buffer[buffer.length - 1] === 0 ? buffer.length - 1 : buffer.length;
        const log = buffer.toString('utf-8', offset, end);
        return { log };
    }

    static parseError(buffer: Buffer, offset: number): {error: string} {
        const end = buffer[buffer.length - 1] === 0 ? buffer.length - 1 : buffer.length;
        const error = buffer.toString('utf-8', offset, end);
        return { error };
    }

    static parseMemory(buffer: Buffer, offset: number): {layout: MemoryLayout} {
        const readMemory = () => {
            const address = buffer.readUInt32LE(offset); offset += 4;
            const size = buffer.readUInt32LE(offset); offset += 4;
            return { address, size };
        };
        const layout = {
            iram: readMemory(),
            dram: readMemory(),
            iflash: readMemory(),
            dflash: readMemory(),
        };
        return { layout };
    }

    static parseExectime(buffer: Buffer, offset: number): {id: number, time: number} {
        const id = buffer.readInt32LE(offset); offset += 4;
        const time = buffer.readFloatLE(offset); offset += 4;
        return { id, time };
    }

    static parseProfile(buffer: Buffer, offset: number): {fid:number, paramtypes:string[]} {
        const fid = buffer.readUInt8(offset); offset += 1;
        const textDecoder = new TextDecoder();
        const paramStr = textDecoder.decode(buffer.subarray(offset, buffer.length - 1));
        return { fid, paramtypes: paramStr ? paramStr.split(", ") : [] };
    }
}