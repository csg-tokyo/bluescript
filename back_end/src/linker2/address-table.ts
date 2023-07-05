import Elf32 from "./elf-parser/elf32";
import {SHNType, STType} from "./elf-parser/elf32-sym";
import {SHFlag} from "./elf-parser/elf32-shdr";

const TEXT_SECTION_NAME = ".text";
const LITERAL_SECTION_NAME = ".literal";

// Virtual section name is a symbol name on MCU (Micro Controller Unit) for storing binaries.
const V_TEXT_SECTION_NAME = "virtual_text";
const V_LITERAL_SECTION_NAME = "virtual_literal";
const V_DATA_SECTION_NAME = "virtual_data";


type Symbol = {
  name: string,
  address: number,
}

type Section = {
  name: string,
  size: number,
  address: number
}

type SubSection = {
  name: string,
  offset: number
}

type DataSection = {
  address: number,
  size: number,
  subSections: Map<string, SubSection>
}

export interface AddressTableInterface {
  readonly parent?: AddressTableInterface;

  symbols: Map<string, Symbol>;
  textSection: Section;
  literalSection: Section;
  dataSection: DataSection;

  getSymbolAddress: (symbolName: string) => number;
  getSymbols: () => Symbol[]; // For debugging.
}

export class AddressTableAncestor implements AddressTableInterface {
  public symbols: Map<string, Symbol>;
  public textSection: Section;
  public literalSection: Section;
  public dataSection: DataSection;

  constructor(mcuElf32: Elf32, nativeSymbolNames: string[]) {
    this.textSection = extractMCUVSection(mcuElf32, V_TEXT_SECTION_NAME);
    this.literalSection = extractMCUVSection(mcuElf32, V_LITERAL_SECTION_NAME);
    this.dataSection = extractMCUVDataSection(mcuElf32, V_DATA_SECTION_NAME);
    this.symbols = extractMCUSymbols(mcuElf32, nativeSymbolNames);
  }

  public getSymbolAddress(symbolName: string): number {
    const symbol = this.symbols.get(symbolName);
    if (symbol === undefined)
      throw Error(`Could not find symbol: ${symbolName}`);
    return symbol.address;
  }

  public getSymbols() {
    const results: Symbol[] = [];
    this.symbols.forEach(s => results.push(s));
    return results;
  }
}


export class AddressTable implements AddressTableInterface {
  readonly parent: AddressTableInterface;

  public symbols: Map<string, Symbol>;
  public textSection: Section;
  public literalSection: Section;
  public dataSection: DataSection;

  constructor(elf32: Elf32, parent: AddressTableInterface) {
    this.parent = parent;
    this.textSection = extractSection(elf32, TEXT_SECTION_NAME, parent.textSection.address + parent.textSection.size);
    this.literalSection = extractSection(elf32, LITERAL_SECTION_NAME, parent.literalSection.address + parent.literalSection.size);
    this.dataSection = extractDataSection(elf32, parent.dataSection.address + parent.dataSection.size);
    this.symbols = extractSymbols(elf32, this.textSection, this.dataSection);
  }

  public getSymbolAddress(symbolName: string): number {
    const symbol = this.symbols.get(symbolName);
    return symbol ? symbol.address : this.parent.getSymbolAddress(symbolName);
  }

  public getSectionAddress(sectionName: string): number {
    if (sectionName === this.textSection.name)
      return this.textSection.address;
    else if (sectionName === this.literalSection.name)
      return this.literalSection.address;
    else {
      const subSection = this.dataSection.subSections.get(sectionName);
      if (subSection === undefined)
        throw Error(`Could not find subsection: ${sectionName}`);
      return this.dataSection.address + subSection.offset;
    }
  }

  public getSymbols() {
    const result = this.parent.getSymbols();
    this.symbols.forEach(s => result.push(s));
    return result;
  }
}


function extractSection(elf32: Elf32, targetName: string, address: number): Section {
  for (const shdr of elf32.shdrs) {
    const sectionName = elf32.getSectionName(shdr);
    if (sectionName === targetName) {
      return {name: sectionName, address, size: shdr.shSize};
    }
  }
  return {name: targetName, address, size: 0};
}

function extractDataSection(elf32: Elf32, address: number) {
  const subSections = new Map<string, SubSection>();
  let nextOffset = 0;
  elf32.shdrs.forEach(shdr => {
    const name = elf32.getSectionName(shdr);
    const isAlloc = !!(shdr.shFlags & SHFlag.SHF_ALLOC)
    if (isAlloc && (name !== TEXT_SECTION_NAME && name !== LITERAL_SECTION_NAME)) {
      subSections.set(name, {name, offset: nextOffset});
      nextOffset += shdr.shSize;
    }
  });
  return {address, size: nextOffset, subSections};
}

function extractSymbols(elf32: Elf32, textSection: Section, dataSection: DataSection) {
  const result = new Map<string, Symbol>();
  elf32.symbols.forEach(symbol => {
    if (symbol.stType === STType.STT_FUNC) {
      const name = elf32.getSymbolName(symbol);
      const address = textSection.address + symbol.stValue;
      result.set(name, {name, address});
    }
    if (symbol.stType === STType.STT_OBJECT) {
      const name = elf32.getSymbolName(symbol);
      let address: number;
      if (symbol.stShndx === SHNType.SHN_COMMON)
        address = 0;
      else {
        const residesSectionName = elf32.getSectionName(elf32.shdrs[symbol.stShndx]);
        const residesSubSection = dataSection.subSections.get(residesSectionName);
        if (residesSubSection === undefined)
          throw Error(`${residesSectionName} does not exists in the data sections.`);
        address = dataSection.address + residesSubSection.offset + symbol.stValue
      }
      result.set(name, {name, address});
    }
  });
  return result;
}

function extractMCUVSection(mcuElf32: Elf32, vSectionName: string): Section {
  for (const symbol of mcuElf32.symbols) {
    const name = mcuElf32.getSymbolName(symbol);
    if (name === vSectionName)
      return {name: vSectionName, size: 0, address: symbol.stValue};
  }
  throw Error(`Could not fine virtual section address. The virtual section name is ${vSectionName}`);
}

function extractMCUVDataSection(mcuElf32: Elf32, vSectionName: string): DataSection {
  for (const symbol of mcuElf32.symbols) {
    const name = mcuElf32.getSymbolName(symbol);
    if (name === vSectionName)
      return {size: 0, address: symbol.stValue, subSections: new Map<string, SubSection>()};
  }
  throw Error(`Could not fine virtual section address. The virtual section name is ${vSectionName}`);
}

function extractMCUSymbols(mcuElf32: Elf32, names: string[]) {
  const results = new Map<string, Symbol>();
  const nameSet = new Set(names);
  for (const symbol of mcuElf32.symbols) {
    const name = mcuElf32.getSymbolName(symbol);
    if (nameSet.has(name)) {
      results.set(name, {name, address: symbol.stValue});
    }
  }
  return results;
}