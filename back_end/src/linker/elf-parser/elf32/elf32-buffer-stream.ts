import { Buffer } from 'node:buffer';

export default class Elf32BufferStream {
    index:number = 0;
    buffer:Buffer;

    constructor(buffer:Buffer) {
        this.buffer = buffer;
    }

    readAddr():number {
        const addrBuffer:Buffer = this.buffer.subarray(this.index, this.index + 4);
        this.index += 4;
        return addrBuffer.readUint32LE(0);
    }

    readHalf():number {
        const halfBuffer:Buffer = this.buffer.subarray(this.index, this.index + 2);
        this.index += 2;
        return halfBuffer.readUint16LE(0);
    }

    readOff():number {
        const offBuffer:Buffer = this.buffer.subarray(this.index, this.index + 4);
        this.index += 4;
        return offBuffer.readUint32LE(0);
    }

    readSword():number {
        const swordBuffer:Buffer = this.buffer.subarray(this.index, this.index + 4);
        this.index += 4;
        return swordBuffer.readUint32LE(0);
    }

    readWord():number {
        const wordBuffer:Buffer = this.buffer.subarray(this.index, this.index + 4);
        this.index += 4;
        return wordBuffer.readUint32LE(0);
    }

    readChar():number {
        const charBuffer:Buffer = this.buffer.subarray(this.index, this.index + 1);
        this.index += 1;
        return charBuffer[0];
    }

    readString(length:number):string {
        const stringBuffer:Buffer = this.buffer.subarray(this.index, this.index + length);
        this.index += length;
        return stringBuffer.toString();
    }
}