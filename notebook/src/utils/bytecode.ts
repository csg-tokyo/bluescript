import {Buffer} from "buffer";
import { MemInfo } from "./type";

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

// The first 2 bytes indicate that the communication is a data transmission.
const FIRST_HEADER_SIZE = 2;
const FIRST_HEADER = [0x03, 0x00];

const LOAD_HEADER_SIZE = 9;

export class BytecodeBufferBuilder {
    private readonly unitSize:number;
    private units: Buffer[] = [];
    private lastUnit: Buffer;
    private lastUnitRemain: number;

    constructor(unitSize: number, useFirstHeader = true) {
        if (useFirstHeader) {
            this.unitSize = unitSize - FIRST_HEADER_SIZE;
            this.lastUnitRemain = this.unitSize;
            this.lastUnit = Buffer.from(FIRST_HEADER);
        } else {
            this.unitSize = unitSize;
            this.lastUnitRemain = this.unitSize;
            this.lastUnit = Buffer.from([]);
        }
    }

    public load(address: number, data: Buffer) {
        let dataRemain = data.length;
        let offset = 0;
        let loadAddress = address;
        while (true) {
            if (LOAD_HEADER_SIZE + dataRemain <= this.lastUnitRemain) {
                const header = this.createLoadHeader(BYTECODE.LOAD, loadAddress, dataRemain);
                const body = data.subarray(offset);
                this.lastUnit = Buffer.concat([this.lastUnit, header, body]);
                this.lastUnitRemain -= LOAD_HEADER_SIZE + dataRemain
                break;
            } else if (LOAD_HEADER_SIZE < this.lastUnitRemain) {
                const loadSize = (this.lastUnitRemain - LOAD_HEADER_SIZE) & ~0b11; // 4 byte align
                const header = this.createLoadHeader(BYTECODE.LOAD, loadAddress, loadSize);
                const body = data.subarray(offset, offset+loadSize);
                this.lastUnit = Buffer.concat([this.lastUnit, header, body]);

                this.units.push(this.lastUnit);
                this.lastUnit = Buffer.from(FIRST_HEADER);
                dataRemain -= loadSize;
                offset += loadSize;
                loadAddress += loadSize;
                this.lastUnitRemain = this.unitSize;
            } else {
                this.units.push(this.lastUnit);
                this.lastUnit = Buffer.from(FIRST_HEADER);
                this.lastUnitRemain = this.unitSize;
            }
        }
        return this
    }

    private createLoadHeader(loadCmd: number, address: number, size: number) {
        const header = Buffer.allocUnsafe(LOAD_HEADER_SIZE);
        header.writeUIntLE(loadCmd, 0, 1); // cmd
        header.writeUIntLE(address, 1, 4); // address
        header.writeUIntLE(size, 5, 4); // size
        return header;
    }


    public jump(id: number, address: number) {
        const header = Buffer.allocUnsafe(9);
        header.writeUIntLE(BYTECODE.JUMP, 0, 1); // cmd
        header.writeIntLE(id, 1, 4); // id
        header.writeUIntLE(address, 5, 4); // address
        if (5 <= this.lastUnitRemain) {
            this.lastUnit = Buffer.concat([this.lastUnit, header]);
        } else {
            this.units.push(this.lastUnit);
            this.lastUnit = Buffer.concat([Buffer.from(FIRST_HEADER), header]);
        }
        return this
    }


    public reset() {
        const header = Buffer.from([BYTECODE.RESET]);
        if (1 <= this.lastUnitRemain) {
            this.lastUnit = Buffer.concat([this.lastUnit, header]);
        } else {
            this.units.push(this.lastUnit);
            this.lastUnit = Buffer.concat([Buffer.from(FIRST_HEADER), header]);
        }
        return this
    }

    public generate() {
        this.units.push(this.lastUnit);
        const result = this.units;

        // Reset
        this.lastUnitRemain = this.unitSize;
        this.units = [];
        this.lastUnit = Buffer.from(FIRST_HEADER);

        return result;
    }
}

type ParseResult = 
    {bytecode:BYTECODE.RESULT_LOG, log:string} | 
    {bytecode:BYTECODE.RESULT_ERROR, error:string} |
    {bytecode:BYTECODE.RESULT_MEMINFO, meminfo:MemInfo} |
    {bytecode:BYTECODE.RESULT_EXECTIME, id: number, exectime:number} |
    {bytecode:BYTECODE.RESULT_PROFILE, fid:number, paramtypes:string[]} |
    {bytecode:BYTECODE.NONE}

export function bytecodeParser(data: DataView):ParseResult {
    const bytecode = data.getUint8(0);
    switch (bytecode) {
      case BYTECODE.RESULT_LOG:
        // | cmd (1byte) | log string |
        return {bytecode, log:Buffer.from(data.buffer.slice(1)).toString()};
      case BYTECODE.RESULT_ERROR:
        // | cmd (1byte) | log string |
        return {bytecode, error:Buffer.from(data.buffer.slice(1)).toString()}
      case BYTECODE.RESULT_MEMINFO:
          // | cmd (1byte) | iram address (4byte) | iram size (4byte) | dram address | dram size | iflash address | iflash size | dflash address | dflash size |
          const meminfo = {
            iram:{address:data.getUint32(1, true), size:data.getUint32(5, true)},
            dram:{address:data.getUint32(9, true), size:data.getUint32(13, true)},
            iflash:{address:data.getUint32(17, true), size:data.getUint32(21, true)},
            dflash:{address:data.getUint32(25, true), size:data.getUint32(29, true)},
          }
          return {bytecode, meminfo};
      case BYTECODE.RESULT_EXECTIME:
        // | cmd (1byte) | id (4byte) | exectime (4byte) |
        return {bytecode, id: data.getInt32(1, true), exectime:data.getFloat32(5, true)};
      case BYTECODE.RESULT_PROFILE:
        let uint8arr = new Uint8Array(data.buffer.slice(0, data.buffer.byteLength-1), 2);
        let textDecoder = new TextDecoder();
        return {bytecode:BYTECODE.RESULT_PROFILE, fid: data.getUint8(1), paramtypes:textDecoder.decode(uint8arr).split(", ")};
      default:
        return {bytecode:BYTECODE.NONE}
    }
}