import {Buffer} from "buffer";
import { MemInfo } from "./type";

export enum BYTECODE {
    NONE,
    LOAD,
    FLOAD,
    JUMP,
    RESET,
    RESULT_LOG,
    RESULT_MEMINFO,
    RESULT_EXECTIME
}

const LOAD_HEADER_SIZE = 9;

export class BytecodeGenerator {
    private readonly unitSize:number;
    private units: Buffer[] = [];
    private lastUnit: Buffer;
    private lastUnitRemain: number;

    constructor(unitSize: number) {
        this.unitSize = unitSize;
        this.lastUnitRemain = unitSize;
        this.lastUnit = Buffer.alloc(0);
    }

    public loadToRAM(address: number, data: Buffer) {
        this.load(BYTECODE.LOAD, address, data);
    }

    public loadToFlash(address: number, data: Buffer) {
        this.load(BYTECODE.FLOAD, address, data);
    }

    private load(loadCmd: number, address: number, data: Buffer) {
        let dataRemain = data.length;
        let offset = 0;
        let loadAddress = address;
        while (true) {
            if (LOAD_HEADER_SIZE + dataRemain <= this.lastUnitRemain) {
                const header = this.createLoadHeader(loadCmd, loadAddress, dataRemain);
                const body = data.subarray(offset);
                this.lastUnit = Buffer.concat([this.lastUnit, header, body]);
                this.lastUnitRemain -= LOAD_HEADER_SIZE + dataRemain
                break;
            } else if (LOAD_HEADER_SIZE < this.lastUnitRemain) {
                const loadSize = (this.lastUnitRemain - LOAD_HEADER_SIZE) & ~0b11; // 4 byte align
                const header = this.createLoadHeader(loadCmd, loadAddress, loadSize);
                const body = data.subarray(offset, offset+loadSize);
                this.lastUnit = Buffer.concat([this.lastUnit, header, body]);

                this.units.push(this.lastUnit);
                this.lastUnit = Buffer.alloc(0);
                dataRemain -= loadSize;
                offset += loadSize;
                loadAddress += loadSize;
                this.lastUnitRemain = this.unitSize;
            } else {
                this.units.push(this.lastUnit);
                this.lastUnit = Buffer.alloc(0);
                this.lastUnitRemain = this.unitSize;
            }
        }
    }

    private createLoadHeader(loadCmd: number, address: number, size: number) {
        const header = Buffer.allocUnsafe(LOAD_HEADER_SIZE);
        header.writeUIntLE(loadCmd, 0, 1); // cmd
        header.writeUIntLE(address, 1, 4); // address
        header.writeUIntLE(size, 5, 4); // size
        return header;
    }


    public jump(address: number) {
        const header = Buffer.allocUnsafe(5);
        header.writeUIntLE(BYTECODE.JUMP, 0, 1); // cmd
        header.writeUIntLE(address, 1, 4);
        if (5 <= this.lastUnitRemain) {
            this.lastUnit = Buffer.concat([this.lastUnit, header]);
        } else {
            this.units.push(this.lastUnit);
            this.lastUnit = header;
        }
    }


    public reset() {
        const header = Buffer.from([BYTECODE.RESET]);
        if (1 <= this.lastUnitRemain) {
            this.lastUnit = Buffer.concat([this.lastUnit, header]);
        } else {
            this.units.push(this.lastUnit);
            this.lastUnit = header;
        }
    }

    public generate() {
        this.units.push(this.lastUnit);
        const result = this.units;

        // Reset
        this.lastUnitRemain = this.unitSize;
        this.units = [];
        this.lastUnit = Buffer.alloc(0);

        return result;
    }
}

type parseResult = 
    {bytecode:BYTECODE.RESULT_LOG, log:string} | 
    {bytecode:BYTECODE.RESULT_MEMINFO, meminfo:MemInfo} |
    {bytecode:BYTECODE.RESULT_EXECTIME, exectime:number} |
    {bytecode:BYTECODE.NONE}

export function bytecodeParser(data: DataView):parseResult {
    const bytecode = data.getUint8(0);
    switch (bytecode) {
      case BYTECODE.RESULT_LOG:
        // | cmd (1byte) | log string |
        const log = Buffer.from(data.buffer.slice(1)).toString();
        return {bytecode, log};
      case BYTECODE.RESULT_MEMINFO:
          // | cmd (1byte) | iram address (4byte) | iram size (4byte) | dram address | dram size | flash address | flash size |
          const meminfo = {
            iram:{address:data.getUint32(1, true), size:data.getUint32(5, true)},
            dram:{address:data.getUint32(9, true), size:data.getUint32(13, true)},
            flash:{address:data.getUint32(17, true), size:data.getUint32(21, true)},
          }
          return {bytecode, meminfo};
      case BYTECODE.RESULT_EXECTIME:
        const exectime = data.getFloat32(1, true);
        return {bytecode, exectime};
      default:
        return {bytecode:BYTECODE.NONE}
    }
}