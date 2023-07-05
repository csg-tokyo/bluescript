import { Buffer } from 'node:buffer';
import Elf32BufferStream from "./elf32-buffer-stream";

export enum SHType {
  SHT_NULL = 0,
  SHT_PROGBITS = 1,
  SHT_SYMTAB = 2,
  SHT_STRTAB = 3,
  SHT_RELA = 4,
  SHT_HASH = 5,
  SHT_DYNAMIC = 6,
  SHT_NOTE = 7,
  SHT_NOBITS = 8,
  SHT_REL = 9,
  SHT_SHLIB = 10,
  SHT_DYNSYM = 11,
  SHT_NUM = 12,
  SHT_LOPROC = 0x70000000,
  SHT_HIPROC = 0x7fffffff,
  SHT_LOUSER = 0x80000000,
  SHT_HIUSER = 0xffffffff,
}

export enum SHFlag {
  SHF_WRITE= 0x1,
  SHF_ALLOC = 0x2,
  SHF_EXECINSTR = 0x4,
  SHF_MERGE = 0x10,
  SHF_STRINGS = 0x20,
  SHF_INFO_LINK = 0x40,
  SHF_LINK_ORDER = 0x80,
  SHF_OS_NONCONFORMING = 0x100,
  SHF_GROUP = 0x200,
  SHF_TLS = 0x400,
  SHF_MASKOS = 0x0ff00000,
  SHF_MASKPROC = 0xf0000000
}

/**
 * Section Header for Elf32.
 * https://refspecs.linuxbase.org/elf/gabi4+/ch4.sheader.html
 */
export default class Elf32Shdr {
  public shName: number; // Position of the section name. Byte offset from the beginning of the .shstrtab section.
  public shType: SHType;
  public shFlags: number;
  public shAddr: number; // The destination virtual address when the section is loaded into memory.
  public shOffset: number; // Position of the section in elf file. Byte offset from the beginning of the elf file.
  public shSize: number; // Byte size of the section.
  public shLink: number;
  public shInfo: number;
  public shAddralign: number;
  public shEntsize: number; // Size of each entry when the section is composed of fixed-size elements.

  constructor(buffer: Buffer, offset: number) {
    const bufferStream = new Elf32BufferStream(buffer, offset);

    this.shName = bufferStream.readWord();
    this.shType = bufferStream.readWord();
    this.shFlags = bufferStream.readWord();
    this.shAddr = bufferStream.readAddr();
    this.shOffset = bufferStream.readOff();
    this.shSize = bufferStream.readWord();
    this.shLink = bufferStream.readWord();
    this.shInfo = bufferStream.readWord();
    this.shAddralign = bufferStream.readWord();
    this.shEntsize = bufferStream.readWord();
  }
}