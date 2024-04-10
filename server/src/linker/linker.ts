import {AddressTable} from "./address-table";
import {Section, Relocation} from "./elf32-parser";
import {Buffer} from "node:buffer";
import Elf32Rela, {RType} from "../linker-old/elf-parser/elf32-rela";
import {STType} from "../linker-old/elf-parser/elf32-sym";


const CALL8 = (to: number, from: number) => (to - (from & (-4)) - 4) * 16 + 0b100101;
const L32R = (base: number, to: number, from: number) => (to - ((from + 3) & (-4)) << 6) + base


export default class Linker {
  private readonly addressTable: AddressTable;

  constructor(addressTable: AddressTable) {
    this.addressTable = addressTable;
  }

  public link(section: Section) {
    const value = section.value;
    const relocations = section.relocations;
    relocations.forEach(relocation => {
      switch (relocation.relocationType) {
        case RType.R_XTENSA_32:
          this.linkRXtensa32(value, relocation);
          break;
        case RType.R_XTENSA_SLOT0_OP:
          this.linkRXtensaSlot0Op(value, relocation);
          break;
        default:
          throw new Error(`There is an unknown relocation type: ${relocation.relocationType}`);
      }
    })
  }

  private linkRXtensa32(value: Buffer, relocation: Relocation) {
    let embedded;
    switch (relocation.targetSymbol.type) {
      case STType.STT_NOTYPE:
        // Do same thing with STT_OBJECT.
      case STType.STT_OBJECT:
        embedded = this.addressTable.symbolAddress(relocation.targetSymbol.symbolName)
                            + value.readUint32LE(relocation.offset)
                            + relocation.addEnd;
        value.writeIntLE(embedded, relocation.offset, 4);
        break;
      case STType.STT_SECTION:
          embedded = this.addressTable.sectionAddress(relocation.targetSymbol.sectionType)
                            + relocation.targetSymbol.offset
                            + value.readUint32LE(relocation.offset)
                            + relocation.addEnd;
          value.writeIntLE(embedded, relocation.offset, 4);
          break;
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_32. symbol type: ${STType[relocation.targetSymbol.type]}`);
    }
  }

  private linkRXtensaSlot0Op(value: Buffer, relocation: Relocation) {
    let from = this.addressTable.sectionAddress(relocation.rSectionType) + relocation.offset; // アドレスを埋め込む対象のrelocationのアドレス。
    let to;
    let embedded;

    switch (relocation.targetSymbol.type) {
      case STType.STT_NOTYPE:
      // Do same thing with STT_FUNC.
      case STType.STT_FUNC:
        to = this.addressTable.symbolAddress(relocation.targetSymbol.symbolName) + relocation.addEnd;
        embedded = CALL8(to, from);
        value.writeUIntLE(embedded, relocation.offset, 3);
        break;
      case STType.STT_SECTION:
        const base = value.readUintLE(relocation.offset, 3);
        if ((base & 0b1111) === 0b0001) { // instruction === l32r
            to = this.addressTable.sectionAddress(relocation.targetSymbol.sectionType)
                        + relocation.targetSymbol.offset
                        + relocation.addEnd;
            embedded = L32R(base & 0xff, to, from);
            if (embedded > 0)
              value.writeUIntLE(embedded, relocation.offset, 3);
            else
              value.writeIntLE(embedded, relocation.offset, 3);
            break;
        }
        throw new Error("Unknown relocation target!");
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_SLOT0_OP. symbol type: ${STType[relocation.targetSymbol.type]}`);
    }
  }
}