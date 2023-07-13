import { Buffer } from 'node:buffer';
import Elf32BufferStream from "./elf32-buffer-stream";

const ELF_ST_BIND = (x:number) => x >> 4;
const ELF_ST_TYPE = (x:number) => x & 0xf;


export enum STBind {
  STB_LOCAL = 0,
  STB_GLOBAL = 1,
  STB_WEAK = 2,
}

export enum STType {
  STT_NOTYPE = 0,
  STT_OBJECT = 1,
  STT_FUNC = 2,
  STT_SECTION = 3,
  STT_FILE = 4,
  STT_COMMON = 5,
  STT_TLS = 6,
}

export enum SHNType {
  SHN_UNDEF = 0,
  SHN_LORESERVE = 0xff00,
  SHN_LOPROC = 0xff00,
  SHN_HIPROC = 0xff1f,
  SHN_ABS = 0xfff1,
  SHN_COMMON = 0xfff2,
  SHN_HIRESERVE = 0xffff
}

/**
 * Symbol Table Entry for Elf32.
 */
export default class Elf32Sym {
  public stName: number; // Position of the symbol name in .strtab section. Byte offset from the beginning of the .strtab section.
  public stValue: number; // Position of the symbol. Byte offset from the beginning of the section symbol embedded.
  public stSize: number; // Byte size of the symbol body.
  public stInfo: number;
  public stOther: number;
  public stShndx: SHNType | number; // Index of the section to which the symbol relates.

  public stBind: STBind;
  public stType: STType;

  constructor(buffer: Buffer, offset = 0) {
    const bufferStream = new Elf32BufferStream(buffer, offset);

    this.stName = bufferStream.readWord();
    this.stValue = bufferStream.readAddr();
    this.stSize = bufferStream.readWord();
    this.stInfo = bufferStream.readChar();
    this.stOther = bufferStream.readChar();
    this.stShndx = bufferStream.readHalf();

    this.stBind = ELF_ST_BIND(this.stInfo);
    this.stType = ELF_ST_TYPE(this.stInfo);
  }
}