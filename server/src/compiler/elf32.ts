import { Buffer } from 'node:buffer';

const SYMBOL_TABLE_SECTION_NAME = ".symtab";
const STRING_SECTION_NAME = ".strtab";

export class ELF32 {
  private readonly buffer: Buffer;

  // ELF32 items
  readonly ehdr: Ehdr;
  readonly shdrs: Shdr[];

  // Special section header ids.
  protected readonly shstrtabId: number; // Index of section name section header in section headers.
  protected readonly strtabId: number; // Index of symbol name section header in section headers.
  protected readonly symtabId: number; // Index of symbol table section header in section headers.

  constructor(buffer: Buffer) {
    this.buffer = buffer;

    this.ehdr = new Ehdr(buffer);
    this.shdrs = this.readShdrs();

    const specialIds = this.readSpecialShdrIds(this.ehdr, this.shdrs);
    this.shstrtabId = specialIds.shstrtabId;
    this.strtabId = specialIds.strtabId;
    this.symtabId = specialIds.symtabId;
  }

  public readSectionName(shdr: Shdr): string {
    const offset = this.shdrs[this.shstrtabId].shOffset + shdr.shName;
    return this.readString(offset);
  }

  public readSectionValue(shdr: Shdr): Buffer {
    const value = Buffer.alloc(shdr.shSize);
    // console.log('Buffer size', this.buffer.length);

    this.buffer.copy(value, 0, shdr.shOffset, shdr.shOffset + shdr.shSize);
    // console.log(this.readSectionName(shdr), value)
    return value;
  }

  public readSyms() {
    const symtab = this.shdrs[this.symtabId];
    const syms: Sym[] = [];
    const numOfSyms = symtab.shSize / symtab.shEntsize;
    for (let i = 0; i < numOfSyms; i++) {
      const offset = symtab.shOffset + symtab.shEntsize * i;
      const symbol = new Sym(this.buffer, offset);
      syms.push(symbol);
    }
    return syms;
  }

  public readSymbolName(sym: Sym): string {
    const offset = this.shdrs[this.strtabId].shOffset + sym.stName;
    return this.readString(offset);
  }

  private readShdrs(): Shdr[] {
    const shdrs: Shdr[] = [];
    for (let i = 0; i < this.ehdr.eShnum; i++) {
      const offset = this.ehdr.eShoff + this.ehdr.eShentsize * i
      const shdr = new Shdr(this.buffer, offset);
      shdrs.push(shdr);
    }
    return shdrs;
  }

  private readSpecialShdrIds(elfHeader: Ehdr, shdrs: Shdr[]) {
    const shstrtabId = elfHeader.eShstrndx;
    const shstrtab = shdrs[shstrtabId];
    const strtabId = shdrs.findIndex(shdr => this.readString(shstrtab.shOffset + shdr.shName) == STRING_SECTION_NAME);
    const symtabId = shdrs.findIndex(shdr => this.readString(shstrtab.shOffset + shdr.shName) == SYMBOL_TABLE_SECTION_NAME);
    return {shstrtabId, strtabId, symtabId};
  }

  private readString(offset: number) {
    if (offset > this.buffer.length)
      throw new Error(`Unexpected error. The offset value(${offset}) is larger than buffer.length(${this.buffer.length})`);
    let end = offset;
    while (this.buffer[end] !== 0)
      end += 1;
    const stringBuffer = this.buffer.subarray(offset, end);
    return stringBuffer.toString();
  }
}


const EI_NIDENT: number = 16
const ELF_ST_BIND = (x:number) => x >> 4;
const ELF_ST_TYPE = (x:number) => x & 0xf;
const ELF32_R_SYM = (x: number) => x >> 8;
const ELF32_R_TYPE = (x: number) => x & 0xff;


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

export enum RType {
  R_XTENSA_32 = 1,
  R_XTENSA_SLOT0_OP = 20
}


/**
 * ELF Header for Elf32.
 */
export class Ehdr {
  static SIZE:number = 54;

  public eIdent: string;
  public eType: number;
  public eMachine: number;
  public eVersion: number;
  public eEntry: number;
  public ePhoff: number; // Position for program header. Byte offset from file head.
  public eShoff: number; // Position for section header. Byte offset from file head.
  public eFlags: number;
  public eEhsize: number;
  public ePhentsize: number; // Size of program header.
  public ePhnum: number; // Number of program header.
  public eShentsize: number; // Size of section header.
  public eShnum: number; // Number of section header.
  public eShstrndx: number; // Section id for section names.

  constructor(buffer: Buffer, offset = 0) {
    const bufferStream = new BufferStream(buffer, offset);

    this.eIdent = bufferStream.readString(EI_NIDENT);
    this.eType = bufferStream.readHalf();
    this.eMachine = bufferStream.readHalf();
    this.eVersion = bufferStream.readWord();
    this.eEntry = bufferStream.readAddr();
    this.ePhoff = bufferStream.readOff();
    this.eShoff = bufferStream.readOff();
    this.eFlags = bufferStream.readWord();
    this.eEhsize = bufferStream.readHalf();
    this.ePhentsize = bufferStream.readHalf();
    this.ePhnum = bufferStream.readHalf();
    this.eShentsize = bufferStream.readHalf();
    this.eShnum = bufferStream.readHalf();
    this.eShstrndx = bufferStream.readHalf();
  }
}

/**
 * Section Header for Elf32.
 * https://refspecs.linuxbase.org/elf/gabi4+/ch4.sheader.html
 */
export class Shdr {
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
    const bufferStream = new BufferStream(buffer, offset);

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


/**
 * Symbol Table Entry for Elf32.
 */
export class Sym {
  public stName: number; // Position of the symbol name in .strtab section. Byte offset from the beginning of the .strtab section.
  public stValue: number; // Position of the symbol. Byte offset from the beginning of the section symbol embedded.
  public stSize: number; // Byte size of the symbol body.
  public stInfo: number;
  public stOther: number;
  public stShndx: SHNType | number; // Index of the section to which the symbol relates.

  public stBind: STBind;
  public stType: STType;

  constructor(buffer: Buffer, offset = 0) {
    const bufferStream = new BufferStream(buffer, offset);

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

/**
 * Relocation Table Entry for Elf32.
 */
export class Rela {
  public rOffset: number; // Relocation byte offset from the beginning of the section.
  public rInfo: number;
  public rAddend: number; // Reference address base value.

  public rSymndx: number; // Symbol id in symbol table.
  public rType: RType;

  constructor(buffer: Buffer, offset = 0) {
    const bufferStream = new BufferStream(buffer, offset);

    this.rOffset = bufferStream.readAddr();
    this.rInfo = bufferStream.readWord();
    this.rAddend = bufferStream.readSword();

    this.rSymndx = ELF32_R_SYM(this.rInfo);
    this.rType = ELF32_R_TYPE(this.rInfo);
  }
}

class BufferStream {
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