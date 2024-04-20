import {LinkedELF32Parser, SECTION_TYPE, Symbol, UnlinkedELF32Parser} from "./elf32-parser";

// Virtual section name is a symbol name on MCU (Micro Controller Unit) for storing binaries.
const V_TEXT_SECTION_NAME = "virtual_text";
const V_DATA_SECTION_NAME = "virtual_data";


export interface AddressTableInterface {
  symbolAddress: (name: string) => number;
  nextTextAddress: () => number;
  nextDataAddress: () => number;
}


export class AddressTableOrigin implements AddressTableInterface {
  private readonly symbols: Map<string, number>;
  private readonly textAddress: number;
  private readonly dataAddress: number;

  constructor(elfParser: LinkedELF32Parser) {
    this.symbols = new Map(elfParser.symbols().map((obj) => [obj.name, obj.address]));
    this.textAddress = AddressTableOrigin.getVSectionAddress(this.symbols, V_TEXT_SECTION_NAME);
    this.dataAddress = AddressTableOrigin.getVSectionAddress(this.symbols, V_DATA_SECTION_NAME);
  }

  public symbolAddress(name: string): number {
    const symbolAddress = this.symbols.get(name);
    if (symbolAddress !== undefined)
      return symbolAddress;
    else
      throw new Error(`Can not find the symbol. The symbol name: ${name}`);
  }

  public nextTextAddress(): number {
    return this.textAddress;
  }

  public nextDataAddress(): number {
    return this.dataAddress;
  }

  private static getVSectionAddress(symbols: Map<string, number>, vSectionName: string): number {
    const vTextAddress = symbols.get(vSectionName);
    if (vTextAddress !== undefined)
      return vTextAddress;
    else
      throw new Error(`Can not find virtual text address. The virtual section name: ${vSectionName}`);
  }
}

export class AddressTable implements AddressTableInterface {
  private readonly parent: AddressTableInterface;

  private readonly symbols: Map<string, number>;
  private readonly textAddress: number;
  private readonly dataAddress: number;

  private textSize: number = 0;
  private dataSize: number = 0;


  constructor(elfParser: UnlinkedELF32Parser, parent: AddressTableInterface) {
    this.parent = parent;
    this.textAddress = parent.nextTextAddress();
    this.dataAddress = parent.nextDataAddress();
    this.symbols = this.decideSymbolAddresses(elfParser.symbols());
  }

  public symbolAddress(name: string): number {
    const symbolAddress = this.symbols.get(name);
    return symbolAddress ? symbolAddress : this.parent.symbolAddress(name);
  }

  public sectionAddress(sectionType: SECTION_TYPE) {
    if (sectionType === SECTION_TYPE.TEXT)
      return this.textAddress;
    else
      return this.dataAddress;
  }

  public nextTextAddress(): number {
    return this.textAddress + this.textSize;
  }

  public nextDataAddress(): number {
    return this.dataAddress + this.dataSize;
  }

  public setTextSize(size: number) {
    this.textSize = size;
  }

  public setDataSize(size: number) {
    this.dataSize = size;
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
}