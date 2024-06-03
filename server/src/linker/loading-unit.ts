import {LinkedELF32Parser, Relocation, Section, SECTION_TYPE, Symbol, UnlinkedELF32Parser} from "./elf32-parser";
import {RType, STType} from "./elf32";
import {Buffer} from "node:buffer";

// Virtual section name is a symbol name on MCU (Micro Controller Unit) for storing binaries.
const V_TEXT_SECTION_NAME = "virtual_text";
const V_DATA_SECTION_NAME = "virtual_data";

const CALL8 = (to: number, from: number) => (to - (from & (-4)) - 4) * 16 + 0b100101;
const L32R = (base: number, to: number, from: number) => (to - ((from + 3) & (-4)) << 6) + base


interface LoadingUnitInterface {
  symbolAddress: (name: string) => number;
  nextTextAddress: () => number;
  nextDataAddress: () => number;
}


export class LoadingUnitOrigin implements LoadingUnitInterface {
  private readonly symbols: Map<string, number>;
  private readonly textAddress: number;
  private readonly dataAddress: number;

  constructor(elfParser: LinkedELF32Parser) {
    this.symbols = new Map(elfParser.symbols().map((obj) => [obj.name, obj.address]));
    this.textAddress = LoadingUnitOrigin.getVSectionAddress(this.symbols, V_TEXT_SECTION_NAME);
    this.dataAddress = LoadingUnitOrigin.getVSectionAddress(this.symbols, V_DATA_SECTION_NAME);
  }

  public symbolAddress(name: string): number {
    const symbolAddress = this.symbols.get(name);
    if (symbolAddress !== undefined)
      return symbolAddress;
    else
      throw new Error(`Can not find the symbol. The symbol name: ${name}`);
  }

  public nextTextAddress() { return this.textAddress }

  public nextDataAddress() { return this.dataAddress }

  private static getVSectionAddress(symbols: Map<string, number>, vSectionName: string): number {
    const vTextAddress = symbols.get(vSectionName);
    if (vTextAddress !== undefined)
      return vTextAddress;
    else
      throw new Error(`Can not find virtual text address. The virtual section name: ${vSectionName}`);
  }
}

export class LoadingUnit implements LoadingUnitInterface {
  private readonly parent: LoadingUnitInterface;

  private readonly symbols: Map<string, number>;
  private readonly textAddress: number;
  private readonly dataAddress: number;

  private readonly text: Section;
  private readonly data: Section;


  constructor(elfParser: UnlinkedELF32Parser, parent: LoadingUnitInterface) {
    this.parent = parent;
    this.textAddress = parent.nextTextAddress();
    this.dataAddress = parent.nextDataAddress();
    this.symbols = this.decideSymbolAddresses(elfParser.symbols());
    this.text = elfParser.textSection();
    this.data = elfParser.dataSection();
    this.link(this.text);
    this.link(this.data);
  }

  public symbolAddress(name: string): number {
    const symbolAddress = this.symbols.get(name);
    return symbolAddress ? symbolAddress : this.parent.symbolAddress(name);
  }

  public textValue() { return this.text.value }

  public dataValue() { return this.data.value }

  public nextTextAddress() { return this.textAddress + this.text.value.length }

  public nextDataAddress() { return this.dataAddress + this.data.value.length }

  private sectionAddress(sectionType: SECTION_TYPE) {
    if (sectionType === SECTION_TYPE.TEXT)
      return this.textAddress;
    else
      return this.dataAddress;
  }

  private decideSymbolAddresses(symbols: Symbol[]): Map<string, number> {
    const symbolAddressMap = new Map<string, number>();
    symbols.forEach(symbol => {
      if (symbol.residesSectionType === SECTION_TYPE.TEXT)
        symbolAddressMap.set(symbol.name, this.textAddress + symbol.offset);
      else
        symbolAddressMap.set(symbol.name, this.dataAddress + symbol.offset);
    });
    return symbolAddressMap;
  }

  private link(section: Section) {
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
      case STType.STT_FUNC:
        // Do same thing with STT_OBJECT.
      case STType.STT_NOTYPE:
      // Do same thing with STT_OBJECT.
      case STType.STT_OBJECT:
        embedded = this.symbolAddress(relocation.targetSymbol.symbolName)
          + value.readUint32LE(relocation.offset)
          + relocation.addEnd;
        writeToBuffer(value, embedded, relocation.offset, 4);
        break;
      case STType.STT_SECTION:
        embedded = this.sectionAddress(relocation.targetSymbol.sectionType)
          + relocation.targetSymbol.offset
          + value.readUint32LE(relocation.offset)
          + relocation.addEnd;
        writeToBuffer(value, embedded, relocation.offset, 4);
        break;
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_32. symbol type: ${STType[relocation.targetSymbol.type]}`);
    }
  }

  private linkRXtensaSlot0Op(value: Buffer, relocation: Relocation) {
    let from = this.sectionAddress(relocation.rSectionType) + relocation.offset; // アドレスを埋め込む対象のrelocationのアドレス。
    let to;
    let embedded;

    switch (relocation.targetSymbol.type) {
      case STType.STT_NOTYPE:
      // Do same thing with STT_FUNC.
      case STType.STT_FUNC:
        to = this.symbolAddress(relocation.targetSymbol.symbolName) + relocation.addEnd;
        embedded = CALL8(to, from);
        writeToBuffer(value, embedded, relocation.offset, 3);
        break;
      case STType.STT_SECTION:
        const base = value.readUintLE(relocation.offset, 3);
        if ((base & 0b1111) === 0b0001) { // instruction === l32r
          to = this.sectionAddress(relocation.targetSymbol.sectionType)
            + relocation.targetSymbol.offset
            + relocation.addEnd;
          embedded = L32R(base & 0xff, to, from);
          writeToBuffer(value, embedded, relocation.offset, 3);
        }
        // throw new Error("Unknown relocation target!");
        console.log("Need caution");
        break;
      default:
        throw new Error(`There is an unknown symbol type with R_XTENSA_SLOT0_OP. symbol type: ${STType[relocation.targetSymbol.type]}`);
    }
  }
}

function writeToBuffer(target: Buffer, embedded: number, offset: number, byteLength: number) {
  if (embedded > 0)
    target.writeUIntLE(embedded, offset, byteLength);
  else
    target.writeIntLE(embedded, offset, byteLength);
}
