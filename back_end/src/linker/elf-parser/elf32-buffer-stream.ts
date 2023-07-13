import { Buffer } from 'node:buffer';

export default class Elf32BufferStream {
  index: number = 0;
  buffer: Buffer;

  constructor(buffer: Buffer, offset = 0) {
    this.buffer = buffer.subarray(offset);
  }

  readAddr():number {
    const addr = this.buffer.readUint32LE(this.index);
    this.index += 4;
    return addr;
  }

  readHalf():number {
    const half = this.buffer.readUint16LE(this.index);
    this.index += 2;
    return half;
  }

  readOff():number {
    const off = this.buffer.readUint32LE(this.index);
    this.index += 4;
    return off;
  }

  readSword():number {
    const sword = this.buffer.readUint32LE(this.index);
    this.index += 4;
    return sword;
  }

  readWord():number {
    const word = this.buffer.readUint32LE(this.index);
    this.index += 4;
    return word;
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