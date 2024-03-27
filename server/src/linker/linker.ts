import {Buffer} from "node:buffer";
import {AddressTable} from "./address-table";
import Elf32 from "./elf-parser/elf32";
import Elf32Rela, {RType} from "./elf-parser/elf32-rela";
import {STType} from "./elf-parser/elf32-sym";

const REL_SECTION_PREFIX = ".rela";
const CALL8 = (to: number, from: number) => (to - (from & (-4)) - 4) * 16 + 0b100101;
const L32R = (base: number, to: number, from: number) => (to - ((from + 3) & (-4)) << 6) + base


export default class Linker {
  private readonly elf32: Elf32;
  private readonly addressTable: AddressTable;

  constructor(elf32: Elf32, addressTable: AddressTable) {
    this.elf32 = elf32;
    this.addressTable = addressTable;
  }

  public linkedValue(sectionName: string): Buffer {
    const value = this.elf32.copySectionValue(sectionName);
    const relocations = this.elf32.relaTables[REL_SECTION_PREFIX + sectionName];
    if (relocations === undefined)
      return value;

    relocations.forEach(relocation => {
      switch (relocation.rType) {
        case RType.R_XTENSA_32:
          this.linkRXtensa32(value, relocation);
          break;
        case RType.R_XTENSA_SLOT0_OP:
          this.linkRXtensaSlot0Op(this.addressTable.getSectionAddress(sectionName), value, relocation);
          break;
        default:
          throw new Error(`There is an unknown relocation type: ${relocation.rType}`);
      }
    });
    return value;
  }

  private linkRXtensa32(value: Buffer, relocation: Elf32Rela) {
    const symbol = this.elf32.symbols[relocation.rSymndx];
    let embedded: number;

    switch (symbol.stType) {
      case STType.STT_NOTYPE:
      case STType.STT_OBJECT:
        const symbolName = this.elf32.getSymbolName(symbol);
        embedded = this.addressTable.getSymbolAddress(symbolName) + value.readUint32LE(relocation.rOffset) + relocation.rAddend;
        break;
      case STType.STT_SECTION:
        const sectionName = this.elf32.getSectionName(this.elf32.shdrs[symbol.stShndx]);
        embedded = this.addressTable.getSectionAddress(sectionName) + value.readUint32LE(relocation.rOffset) + relocation.rAddend;
        break;
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_32. symbol type: ${STType[symbol.stType]}`);
    }

    // Write down jumpedAddress.
    value.writeIntLE(embedded, relocation.rOffset, 4);
  }

  // baseAddress: Address of the section.
  private linkRXtensaSlot0Op(baseAddress: number, value: Buffer, relocation: Elf32Rela) {
    const symbol = this.elf32.symbols[relocation.rSymndx];

    let embedded: number;
    const base = value.readUintLE(relocation.rOffset, 3);
    let from = baseAddress + relocation.rOffset;
    let to: number;

    switch (symbol.stType) {
      case STType.STT_FUNC:
      case STType.STT_NOTYPE:
        const symbolName = this.elf32.getSymbolName(symbol);
        to = this.addressTable.getSymbolAddress(symbolName) + relocation.rAddend;
        embedded = CALL8(to, from);
        value.writeUIntLE(embedded, relocation.rOffset, 3);
        break;
      case STType.STT_SECTION:
        if ((base & 0b1111) === 0b0001) { // instruction === l32r TODO: 全体に共通のlink方法を見つける。
          const sectionName = this.elf32.getSectionName(this.elf32.shdrs[symbol.stShndx]);
          to = this.addressTable.getSectionAddress(sectionName) + relocation.rAddend;
          embedded = L32R(base, to, from);
          value.writeIntLE(embedded, relocation.rOffset, 3);
        }
        break;
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_SLOT0_OP. symbol type: ${STType[symbol.stType]}`);
    }
  }
}