import {Buffer} from "buffer";

export enum BS_CMD {
    NONE,
    LOAD,
    FLOAD,
    JUMP,
    RESET,
    RESULT_LOG,
    RESULT_MEMINFO,
    RESULT_EXECTIME
}

export class BufferGenerator {
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
        this.load(BS_CMD.LOAD, address, data);
    }

    public loadToFlash(address: number, data: Buffer) {
        this.load(BS_CMD.FLOAD, address, data);
    }

    private load(loadCmd: number, address: number, data: Buffer) {
        let dataRemain = data.length;
        let offset = 0;
        let loadAddress = address;
        while (true) {
            if (9 + dataRemain <= this.lastUnitRemain) {
                const header = this.createLoadHeader(loadCmd, loadAddress, dataRemain);
                const body = data.subarray(offset);
                this.lastUnit = Buffer.concat([this.lastUnit, header, body]);
                this.lastUnitRemain -= 9 + dataRemain
                break;
            } else if (9 < this.lastUnitRemain) {
                const loadSize = this.lastUnitRemain - 9;
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
        const header = Buffer.allocUnsafe(9);
        header.writeUIntLE(loadCmd, 0, 1); // cmd
        header.writeUIntLE(address, 1, 4); // address
        header.writeUIntLE(size, 5, 4); // size
        return header;
    }


    public jump(address: number) {
        const header = Buffer.allocUnsafe(5);
        header.writeUIntLE(BS_CMD.JUMP, 0, 1); // cmd
        header.writeUIntLE(address, 1, 4);
        if (5 <= this.lastUnitRemain) {
            this.lastUnit = Buffer.concat([this.lastUnit, header]);
        } else {
            this.units.push(this.lastUnit);
            this.lastUnit = header;
        }
    }


    public reset() {
        const header = Buffer.from([BS_CMD.RESET]);
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