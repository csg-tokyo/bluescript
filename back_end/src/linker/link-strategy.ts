import {ElfRelocation, ElfSymbol} from "./models";
import {Buffer} from "node:buffer";
import ELF_PARSER_CONSTANTS from "../utils/elf-parser/static/elf-parser-constants";
import {SectionName} from "./models";

export default class LinkStrategy {
  sectionAddresses: {[name: string]: number};
  symbolAddresses: {[name: string]: number};
  elfSymbols: ElfSymbol[];

  constructor(sectionAddresses: {[name: string]: number},symbolAddresses: {[name: string]: number}, elfSymbols: ElfSymbol[]) {
    this.sectionAddresses = sectionAddresses;
    this.symbolAddresses = symbolAddresses;
    this.elfSymbols = elfSymbols;
  }

  link(sectionName: SectionName, unlinkedValue:Buffer, relocations: ElfRelocation[]): Buffer {
    const value = Buffer.allocUnsafe(unlinkedValue.length);
    unlinkedValue.copy(value);
    relocations.forEach(relocation => {
      switch (relocation.type) {
        case ELF_PARSER_CONSTANTS.R_XTENSA_32:
          this.linkRXtensa32(value, relocation);
          break;
        case ELF_PARSER_CONSTANTS.R_XTENSA_SLOT0_OP:
          this.linkRXtensaSlot0Op(sectionName, value, relocation);
          break;
        default:
          throw new Error(`There is an unknown relocation type: ${relocation.type}`);
      }
    })
    return value;
  }

  private linkRXtensa32(value: Buffer, relocation: ElfRelocation) {
    const elfSymbol = this.elfSymbols[relocation.symbolId];
    let jumpedAddress: number;
    switch (elfSymbol.type) {
      case ELF_PARSER_CONSTANTS.STT_NOTYPE:
        jumpedAddress = this.getDDSymbolAddress(elfSymbol) + value.readUint32LE(relocation.offset);
        value.writeIntLE(jumpedAddress, relocation.offset, 4);
        break;
      case ELF_PARSER_CONSTANTS.STT_SECTION:
        if(elfSymbol.residesSectionName == null)  throw new Error("something wrong happened with linkRXtensa32");
        jumpedAddress = this.sectionAddresses[elfSymbol.residesSectionName] + value.readUint32LE(relocation.offset);
        value.writeIntLE(jumpedAddress, relocation.offset, 4);
        break;
      case ELF_PARSER_CONSTANTS.STT_OBJECT:
        if(elfSymbol.residesSectionName == null)  throw new Error("something wrong happened with linkRXtensa32");
        jumpedAddress = this.sectionAddresses[elfSymbol.residesSectionName] + elfSymbol.offset + value.readUint32LE(relocation.offset);
        value.writeIntLE(jumpedAddress, relocation.offset, 4);
        break;
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_32. symbol type: ${elfSymbol.type}`);
    }
  }

  private linkRXtensaSlot0Op(sectionName: SectionName, value: Buffer, relocation: ElfRelocation) {
    const elfSymbol = this.elfSymbols[relocation.symbolId];
    let jumpedAddress: number;
    let relocationTargetAddress: number;
    let instruction: number;

    switch (elfSymbol.type) {
      case ELF_PARSER_CONSTANTS.STT_NOTYPE:
        jumpedAddress = this.getDDSymbolAddress(elfSymbol);
        relocationTargetAddress = this.sectionAddresses[sectionName] + relocation.offset;
        instruction = this.linkCall8(jumpedAddress, relocationTargetAddress);
        value.writeIntLE(instruction, relocation.offset, 3);
        break;
      case ELF_PARSER_CONSTANTS.STT_SECTION:
        const base = value.readUint16LE(relocation.offset);
        if (base % 16 === 1) { // l32r命令だったら
          if(elfSymbol.residesSectionName == null)  throw new Error("something wrong happened with linkRXtensaSlot0Op");
          jumpedAddress = this.sectionAddresses[elfSymbol.residesSectionName] + relocation.addEnd;
          relocationTargetAddress = this.sectionAddresses[sectionName] + relocation.offset;
          instruction = this.linkL32r(base, jumpedAddress, relocationTargetAddress);
          value.writeIntLE(instruction, relocation.offset, 3);
        }
        break;
      case ELF_PARSER_CONSTANTS.STT_FUNC:
        if(elfSymbol.residesSectionName == null)  throw new Error("something wrong happened with linkRXtensaSlot0Op");
        jumpedAddress = this.sectionAddresses[elfSymbol.residesSectionName] + elfSymbol.offset;
        relocationTargetAddress = this.sectionAddresses[sectionName] + relocation.offset;
        instruction = this.linkCall8(jumpedAddress, relocationTargetAddress);
        value.writeIntLE(instruction, relocation.offset, 3);
        break;
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_32. symbol type: ${elfSymbol.type}`);
    }
  }

  private getDDSymbolAddress(symbol: ElfSymbol): number {
    if (symbol.name in this.symbolAddresses) {
      return this.symbolAddresses[symbol.name];
    } else {
      throw new Error(`Could not find the DD symbol. Symbol name is: ${symbol.name}`);
    }
  }

  private linkL32r(base: number, jumpedAddress: number, l32rAddress: number): number {
    return (jumpedAddress - ((l32rAddress + 3) & (-4)) << 6) + base;
  }


  private linkCall8(jumpedAddress: number, call8Address: number): number {
    return (jumpedAddress - (call8Address & (-4)) - 4) * 16 + 0b100101;
  }
}