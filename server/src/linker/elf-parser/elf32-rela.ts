import { Buffer } from 'node:buffer';
import Elf32BufferStream from "./elf32-buffer-stream";

const ELF32_R_SYM = (x: number) => x >> 8;
const ELF32_R_TYPE = (x: number) => x & 0xff;

export enum RType {
  R_XTENSA_32 = 1,
  R_XTENSA_SLOT0_OP = 20
}

/**
 * Relocation Table Entry for Elf32.
 */
export default class Elf32Rela {
  public rOffset: number; // Relocation byte offset from the beginning of the section.
  public rInfo: number;
  public rAddend: number; // Reference address base value.

  public rSymndx: number; // Symbol id in symbol table.
  public rType: RType;

  constructor(buffer: Buffer, offset = 0) {
    const bufferStream = new Elf32BufferStream(buffer, offset);

    this.rOffset = bufferStream.readAddr();
    this.rInfo = bufferStream.readWord();
    this.rAddend = bufferStream.readSword();

    this.rSymndx = ELF32_R_SYM(this.rInfo);
    this.rType = ELF32_R_TYPE(this.rInfo);
  }
}
