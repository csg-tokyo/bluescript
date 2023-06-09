import {ElfRelocation, ElfSymbol} from "./models";
import {Buffer} from "node:buffer";
import Elf from "../utils/elf-parser/elf";
import ELF_PARSER_CONSTANTS from "../utils/elf-parser/static/elf-parser-constants";
import Elf32Sym from "../utils/elf-parser/elf32/elf32-sym";
import LinkStrategy from "./link-strategy";
import SectionValue from "./section-value";
import CONSTANTS from "../constants";


export default class SectionValueFactory {
  private elf: Elf;
  private readonly symbolAddresses: {[name:string]: number};
  private readonly sectionAddresses: {[name:string]: number};

  constructor(elfBuffer: Buffer, symbolAddresses: {[name:string]: number}, sectionAddresses: {[name:string]: number}) {
    this.elf = new Elf(elfBuffer);
    this.symbolAddresses = symbolAddresses;
    this.sectionAddresses = sectionAddresses;
  }

  public generateSectionValue(name: string): SectionValue {
    const relocations = this.getRelocations(name);
    const value = this.getSectionValue(name);
    return new SectionValue(name, relocations, value);
  }

  public generateStrategy(): LinkStrategy {
    const elfSymbols = this.getElfSymbols();
    return new LinkStrategy(this.sectionAddresses, this.symbolAddresses, elfSymbols);
  }

  // Elfの中から、指定されたシンボルのアドレスを抽出する。
  public getSymbolAddresses(symbolNames: string[]): {[name:string]: number} {
    if (this.elf.symbolNameSectionHeader === null) {
      throw new Error("section header of symbol names does not exist.");
    }
    const symbolNamesPool = new Set(symbolNames);
    const result: {[name:string]: number} = {};
    const symNameShOffset = this.elf.symbolNameSectionHeader.shOffset;
    this.elf.symbols.forEach(rawSymbol => {
      const symbolName = this.elf.getStringFromBuffer(symNameShOffset + rawSymbol.stName);
      if (symbolNamesPool.has(symbolName)) {
        const symbolResidesSectionName = this.getSymbolResidesSectionName(rawSymbol);
        if (symbolResidesSectionName === null) {
          throw new Error("There is a symbol which resides in a unknown section. symbolName: " + symbolName);
        }
        result[symbolName] = this.sectionAddresses[symbolResidesSectionName] + rawSymbol.stValue
      }
    });
    return result;
  }

  private getElfSymbols(): ElfSymbol[] {
    if (this.elf.symbolNameSectionHeader === null) {
      throw new Error("section header of symbol names does not exist.");
    }
    const symNameShOffset = this.elf.symbolNameSectionHeader.shOffset;
    const linkerSymbols: ElfSymbol[] = [];
    this.elf.symbols.forEach(rawSymbol => {
      const symbolName = this.elf.getStringFromBuffer(symNameShOffset + rawSymbol.stName);
      linkerSymbols.push({
        name: symbolName,
        type: ELF_PARSER_CONSTANTS.ELF_ST_TYPE(rawSymbol.stInfo),
        offset: rawSymbol.stValue,
        residesSectionName: this.getSymbolResidesSectionName(rawSymbol)
      })
    })
    return linkerSymbols;
  }

  private getRelocations(sectionName: string): ElfRelocation[] {
    const relocations: ElfRelocation[] = [];
    const targetRelSectionName = ".rela" + sectionName;
    this.elf.relocationTables.forEach(table => {
      const relSectionHeader = this.elf.sectionHeaders[table.sectionHeaderId];
      const relSectionName = this.elf.getStringFromBuffer(this.elf.sectionNameSectionHeader.shOffset + relSectionHeader.shName);
      if (targetRelSectionName === relSectionName) {
        table.relocations.forEach(rawRel => {
          relocations.push({
            offset: rawRel.rOffset,
            symbolId: ELF_PARSER_CONSTANTS.ELF32_R_SYM(rawRel.rInfo),
            type: ELF_PARSER_CONSTANTS.ELF32_R_TYPE(rawRel.rInfo),
            addEnd: rawRel.rAddend
          })
        })
      }
    })
    return relocations;
  }

  private getSectionValue(sectionName: string): Buffer {
    let value: Buffer;
    for (const sectionHeader of this.elf.sectionHeaders) {
      const sectionNameStart = this.elf.sectionNameSectionHeader.shOffset + sectionHeader.shName;
      const name = this.elf.getStringFromBuffer(sectionNameStart);
      if (name === sectionName) {
        value = this.elf.getSubBuffer(sectionHeader.shOffset, sectionHeader.shSize);
        return value;
      }
    }
    // もし見つからなかったら
    console.log("Could not find section value: " + sectionName);
    return Buffer.from([]);
  }

  private getSymbolResidesSectionName(symbol: Elf32Sym): string | null {
    if (symbol.stShndx === ELF_PARSER_CONSTANTS.SHN_ABS || symbol.stShndx === ELF_PARSER_CONSTANTS.SHN_UNDEF)
      return null;
    if (symbol.stShndx === ELF_PARSER_CONSTANTS.SHN_COMMON)
      return "bss"; // TODO: 本当にこれで良いのか？
    // 一番最初の"."を取り除いたものがSectionNameArrに含まれていたら、SectionNameを返す。
    const sectionNameStr: string = this.elf.getStringFromBuffer(this.elf.sectionNameSectionHeader.shOffset + this.elf.sectionHeaders[symbol.stShndx].shName);
    const realSectionNames = CONSTANTS.VIRTUAL_SECTION_NAMES.map(name => name.realName)
    const sectionNameIndex = realSectionNames.findIndex(str => str === sectionNameStr)
    return sectionNameIndex === -1 ? null : realSectionNames[sectionNameIndex];
  }
}