import {Buffer} from "node:buffer";
import * as fs from "fs";
import {ELF32, SHFlag, STBind, STType} from "./elf32";

export enum SYMBOL_TYPE {
  FUNCTION,
  OBJECT,
  NONE
}

export enum SECTION_TYPE {
  EXECUTABLE,
  WRITABLE,
  READABLE
}

export type Section = {
  name: string,
  address: number,
  size: number,
  value: Buffer;
}

export type Symbol = {
  name: string,
  address: number,
  type: SYMBOL_TYPE
}


export class ElfReader {
  private readonly elf;

  constructor(path: string) {
    this.elf = new ELF32(fs.readFileSync(path));
  }

  public readDefinedSymbols():Symbol[] {
    return this.readSymbols([STType.STT_FUNC, STType.STT_OBJECT])
  }

  public readAllSymbols() {
    return this.readSymbols([STType.STT_FUNC, STType.STT_OBJECT, STType.STT_NOTYPE])
  }

  public readExternalSymbols():Symbol[] {
    return this.readSymbols([STType.STT_NOTYPE])
  }

  public readFunctions(): Symbol[] {
    return this.readSymbols([STType.STT_FUNC])
  }

  private readSymbols(types: STType[]): Symbol[] {
    const syms = this.elf.readSyms();
    const symbols:Symbol[] = [];
    syms.forEach(sym => {
      const symName = this.elf.readSymbolName(sym);
      if ((types.includes(sym.stType)) && sym.stBind === STBind.STB_GLOBAL) {
        const symbol:Symbol = {
          name: symName,
          address: sym.stValue,
          type: this.stTypeToSymbolType(sym.stType)
        }
        symbols.push(symbol);
      }
    });
    return symbols;
  }

  private stTypeToSymbolType(stType: STType) {
    if (stType === STType.STT_FUNC)
      return SYMBOL_TYPE.FUNCTION
    else if (stType === STType.STT_OBJECT)
      return SYMBOL_TYPE.OBJECT
    else
      return SYMBOL_TYPE.NONE
  }

  public readSections(type: SECTION_TYPE) {
    const sections:Section[] = [];
    this.elf.shdrs.forEach(shdr => {
      const name = this.elf.readSectionName(shdr);
      const section = {
        name,
        address: shdr.shAddr,
        size: shdr.shSize,
        value: this.elf.readSectionValue(shdr)
      }
      if (!!(shdr.shFlags & SHFlag.SHF_ALLOC)) {
        if (type === SECTION_TYPE.EXECUTABLE && !!(shdr.shFlags & SHFlag.SHF_EXECINSTR))
          sections.push(section);
        else if (type === SECTION_TYPE.WRITABLE && !!(shdr.shFlags & SHFlag.SHF_WRITE))
          sections.push(section);
        else if (type === SECTION_TYPE.READABLE
          && !(shdr.shFlags & SHFlag.SHF_EXECINSTR) && !(shdr.shFlags & SHFlag.SHF_WRITE))
          sections.push(section);
      }
    });
    return sections;
  }

  public readSectionByName(sectionName: string):Section|undefined {
    let section:Section|undefined = undefined;
    this.elf.shdrs.forEach(shdr => {
      const name = this.elf.readSectionName(shdr);
      if (name === sectionName) {
        section = {
          name,
          address: shdr.shAddr,
          size: shdr.shSize,
          value: this.elf.readSectionValue(shdr)
        }
      }
    });
    return section;
  }
}
