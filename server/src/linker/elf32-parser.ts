import {Buffer} from "node:buffer";
import * as ELF32 from "./elf32";


const TEXT_SECTION_NAME = ".text";
const RELA_SECTION_PREFIX = ".rela";

const SYMBOL_TABLE_SECTION_NAME = ".symtab";
const STRING_SECTION_NAME = ".strtab";

export enum SECTION_TYPE {
  TEXT,
  DATA,
}

export type Symbol = {
  name: string,
  offset: number,
  residesSectionType: SECTION_TYPE
}

export type LinkedSymbol = {
  name: string,
  address: number
}

export type Section =  {
  type: SECTION_TYPE,
  value: Buffer,
  relocations: Relocation[]
}

type rTargetSymbol =
  {type: ELF32.STType.STT_SECTION, sectionType: SECTION_TYPE, offset: number}
| {type: ELF32.STType.STT_FUNC | ELF32.STType.STT_OBJECT | ELF32.STType.STT_NOTYPE, symbolName: string}
| {type: ELF32.STType.STT_FILE | ELF32.STType.STT_COMMON | ELF32.STType.STT_TLS} // Other type.

export type Relocation = {
  relocationType: ELF32.RType,
  targetSymbol: rTargetSymbol,
  rSectionType: SECTION_TYPE,    // Relocation target section type. When the relocation section name is ".rela.text", the rSectionType is SECTION_TYPE.TEXT.
  offset: number,  // Relocation target offset from section head.
  addEnd: number,
}


class ELF32Parser {
  private readonly buffer: Buffer;

  // ELF32 items
  protected readonly elf32Ehdr: ELF32.Ehdr;
  protected readonly elf32Shdrs: ELF32.Shdr[];
  protected readonly elf32Syms: ELF32.Sym[];
  protected readonly elf32RelaTables: { [rSectionName: string]: ELF32.Rela[] }; // The key is name of relocation table section.

  // Special section header ids.
  protected readonly elf32ShstrtabId: number; // Index of section name section header in section headers.
  protected readonly elf32StrtabId: number; // Index of symbol name section header in section headers.
  protected readonly elf32SymtabId: number; // Index of symbol table section header in section headers.

  constructor(buffer: Buffer) {
    this.buffer = buffer;

    this.elf32Ehdr = new ELF32.Ehdr(buffer);
    this.elf32Shdrs = ELF32Parser.readShdrs(buffer, this.elf32Ehdr);

    const specialIds = ELF32Parser.readSpecialShdrIds(buffer, this.elf32Ehdr, this.elf32Shdrs);
    this.elf32ShstrtabId = specialIds.shstrtabId;
    this.elf32StrtabId = specialIds.strtabId;
    this.elf32SymtabId = specialIds.symtabId;

    this.elf32Syms = ELF32Parser.readSyms(buffer, this.elf32Shdrs, this.elf32SymtabId);
    this.elf32RelaTables = ELF32Parser.readRelaTables(buffer, this.elf32Shdrs, this.elf32ShstrtabId);
  }

  protected readSectionName(shdr: ELF32.Shdr): string {
    const offset = this.elf32Shdrs[this.elf32ShstrtabId].shOffset + shdr.shName;
    return ELF32Parser.readString(this.buffer, offset);
  }

  protected readSymbolName(sym: ELF32.Sym): string {
    const offset = this.elf32Shdrs[this.elf32StrtabId].shOffset + sym.stName;
    return ELF32Parser.readString(this.buffer, offset);
  }

  protected copySectionValue(shdr: ELF32.Shdr): Buffer {
    const value = Buffer.alloc(shdr.shSize);
    if (this.readSectionName(shdr) === ".bss")
      return value;
    this.buffer.copy(value, 0, shdr.shOffset, shdr.shOffset + shdr.shSize);
    return value;
  }

  protected static readShdrs(buffer: Buffer, elfHeader: ELF32.Ehdr): ELF32.Shdr[] {
    const shdrs: ELF32.Shdr[] = [];
    for (let i = 0; i < elfHeader.eShnum; i++) {
      const offset = elfHeader.eShoff + elfHeader.eShentsize * i
      const shdr = new ELF32.Shdr(buffer, offset);
      shdrs.push(shdr);
    }
    return shdrs;
  }

  protected static readSpecialShdrIds(buffer: Buffer, elfHeader: ELF32.Ehdr, shdrs: ELF32.Shdr[]) {
    const shstrtabId = elfHeader.eShstrndx;
    const shstrtab = shdrs[shstrtabId];
    const strtabId = shdrs.findIndex(shdr => ELF32Parser.readString(buffer, shstrtab.shOffset + shdr.shName) == STRING_SECTION_NAME);
    const symtabId = shdrs.findIndex(shdr => ELF32Parser.readString(buffer, shstrtab.shOffset + shdr.shName) == SYMBOL_TABLE_SECTION_NAME);
    return {shstrtabId, strtabId, symtabId};
  }

  protected static readSyms(buffer: Buffer, shdrs: ELF32.Shdr[], symtabId: number) {
    const symtab = shdrs[symtabId];
    const syms: ELF32.Sym[] = [];
    const numOfSyms = symtab.shSize / symtab.shEntsize;
    for (let i = 0; i < numOfSyms; i++) {
      const offset = symtab.shOffset + symtab.shEntsize * i;
      const symbol = new ELF32.Sym(buffer, offset);
      syms.push(symbol);
    }
    return syms;
  }

  protected static readRelaTables(buffer: Buffer, shdrs: ELF32.Shdr[], shstrtabId: number) {
    const tables: { [sectionName: string]: ELF32.Rela[] } = {};
    const relaShdrs = shdrs.filter(shdr => shdr.shType === ELF32.SHType.SHT_RELA);
    const shstrtab = shdrs[shstrtabId];
    relaShdrs.forEach(shdr => {
      const sectionName = this.readString(buffer, shstrtab.shOffset + shdr.shName);
      const relas: ELF32.Rela[] = [];
      const numOfRelas = shdr.shSize / shdr.shEntsize;
      for (let i = 0; i < numOfRelas; i++) {
        const offset = shdr.shOffset + shdr.shEntsize * i;
        relas.push(new ELF32.Rela(buffer, offset));
      }
      tables[sectionName] = relas;
    });
    return tables;
  }

  protected static readString(buffer: Buffer, offset: number) {
    if (offset > buffer.length)
      throw new Error(`Unexpected error. The offset value(${offset}) is larger than buffer.length(${buffer.length})`);
    let end = offset;
    while (buffer[end] !== 0)
      end += 1;
    const stringBuffer = buffer.subarray(offset, end);
    return stringBuffer.toString();
  }
}

export class UnlinkedELF32Parser extends ELF32Parser {
  private _dataSubSections?: {name: string, offset: number, value: Buffer}[];

  constructor(buffer: Buffer) {
    super(buffer);
  }

  public symbols(): Symbol[] {
    const symbols: Symbol[] = [];
    const dataSubsectionOffsets = this.dataSubSectionOffsetMap;
    this.elf32Syms.forEach(sym => {
      if (sym.stType === ELF32.STType.STT_FUNC) {
        symbols.push({
          name: this.readSymbolName(sym),
          offset: sym.stValue,
          residesSectionType: SECTION_TYPE.TEXT
        });
      } else if (sym.stType === ELF32.STType.STT_OBJECT) {
        const name = this.readSymbolName(sym);
        const residesSectionName = this.readSectionName(this.elf32Shdrs[sym.stShndx]);
        const residesSectionOffset = dataSubsectionOffsets.get(residesSectionName);
        if (residesSectionOffset === undefined)
          throw new Error(`Something wrong happened! Unknown section name: ${residesSectionOffset}`);
        symbols.push({
          name,
          offset: residesSectionOffset + sym.stValue,
          residesSectionType: SECTION_TYPE.DATA
        });
      }
    });
    return symbols;
  }

  public textSection(): Section {
    for (const shdr of this.elf32Shdrs) {
      const sectionName = this.readSectionName(shdr);
      if (sectionName === TEXT_SECTION_NAME) {
        return {
          type: SECTION_TYPE.TEXT,
          value: this.align4(this.copySectionValue(shdr)),
          relocations: this.relocations(RELA_SECTION_PREFIX + TEXT_SECTION_NAME, SECTION_TYPE.TEXT)
        };
      }
    }
    return {type: SECTION_TYPE.TEXT, value: Buffer.allocUnsafe(0), relocations:[]}
  }

  public dataSection(): Section {
    const dataSubSections = this.dataSubSections;
    const dataValues: Buffer[] = [];
    let relocations: Relocation[] = [];
    const dataSubsectionOffsets = this.dataSubSectionOffsetMap;
    dataSubSections.forEach(section => {
      const sectionName = section.name;
      dataValues.push(section.value);
      relocations = relocations.concat(
        this.relocations(RELA_SECTION_PREFIX + sectionName, SECTION_TYPE.DATA, dataSubsectionOffsets.get(sectionName))
      )
    });
    return {type: SECTION_TYPE.DATA, value: Buffer.concat(dataValues), relocations}
  }

  private relocations(rSectionName: string, rTargetSectionType: SECTION_TYPE, baseROffset?: number): Relocation[] {
    const relocations: Relocation[] = [];
    const relas = this.elf32RelaTables[rSectionName];
    if (relas === undefined)
      return [];
    relas.forEach(rela => {
      const targetSym = this.elf32Syms[rela.rSymndx];
      let rOffset = rela.rOffset;
      rOffset += baseROffset ? baseROffset : 0;
      let targetSymbol:rTargetSymbol;
      if (targetSym.stType === ELF32.STType.STT_SECTION) {
        const sectionName = this.readSectionName(this.elf32Shdrs[targetSym.stShndx]);
        const dataSubsectionOffset = this.dataSubSectionOffsetMap.get(sectionName);
        let sectionType: SECTION_TYPE;
        let offset = 0;
        if (sectionName === TEXT_SECTION_NAME) {
          sectionType = SECTION_TYPE.TEXT;
        } else if (dataSubsectionOffset !== undefined) {
          offset = dataSubsectionOffset;
          sectionType = SECTION_TYPE.DATA;
        } else {
          throw new Error(`Something wrong happened!. The section name: ${sectionName}`)
        }
        targetSymbol = {
          type: ELF32.STType.STT_SECTION,
          sectionType,
          offset,
        }
      } else if (targetSym.stType === ELF32.STType.STT_OBJECT
        || targetSym.stType === ELF32.STType.STT_FUNC
        || targetSym.stType === ELF32.STType.STT_NOTYPE
      ) {
        targetSymbol = {
          type: targetSym.stType,
          symbolName: this.readSymbolName(targetSym)
        }
      } else {
        targetSymbol = {type: targetSym.stType}
      }
      relocations.push({
        relocationType: rela.rType,
        targetSymbol,
        rSectionType: rTargetSectionType,
        offset: rOffset,
        addEnd: rela.rAddend
      });
    });
    return relocations;
  }

  private align4(buffer: Buffer) {
    return Buffer.concat([buffer, Buffer.alloc(-buffer.length & 3)])
  }

  private get dataSubSections(): {name: string, offset: number, value: Buffer}[] {
    if (this._dataSubSections)
      return this._dataSubSections;

    const subSections:{name: string, offset: number, value: Buffer}[] = [];
    let nextOffset = 0;
    this.elf32Shdrs.forEach(shdr => {
      const name = this.readSectionName(shdr);
      const isAlloc = !!(shdr.shFlags & ELF32.SHFlag.SHF_ALLOC)
      if (isAlloc && (name !== TEXT_SECTION_NAME)) {
        let value = this.align4(this.copySectionValue(shdr));
        subSections.push({name, offset: nextOffset, value});
        nextOffset += value.length;
      }
    });
    this._dataSubSections = subSections;
    return subSections;
  }

  private get dataSubSectionOffsetMap(): Map<string, number> {
    return new Map(this.dataSubSections.map((obj) => [obj.name, obj.offset]))
  }
}


export class LinkedELF32Parser extends ELF32Parser {
  constructor(buffer: Buffer) {
    super(buffer);
  }

  public symbols(): LinkedSymbol[] {
    const symbols: LinkedSymbol[] = [];
    this.elf32Syms.forEach((sym) => {
      if (sym.stType == ELF32.STType.STT_OBJECT || sym.stType == ELF32.STType.STT_FUNC) {
        const name = this.readSymbolName(sym);
        symbols.push({name, address: sym.stValue});
      }
    });
    return symbols;
  }
}
