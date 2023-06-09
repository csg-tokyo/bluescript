import * as fs from 'fs';
import CONSTANTS from "../constants";
import Elf from "../utils/elf-parser/elf";


export default class AddressTable {
  public symbolTable: SymbolTable
  public sectionTable: SectionTable

  constructor(symbolNames: string[]) {
    const symbols = this.microcontrollerAddresses(symbolNames)
    const virtualSections = this.microcontrollerAddresses(CONSTANTS.VIRTUAL_SECTION_NAMES.map(name => name.virtualName))
    // Convert virtual section names to real name.
    const sections:{[name: string]: number} = {}
    Object.keys(virtualSections).forEach(virtualName => {
      const realName = CONSTANTS.VIRTUAL_SECTION_NAMES.find(name => name.virtualName == virtualName)?.realName
      if (realName)
        sections[realName] = virtualSections[virtualName]
      else
        throw Error("Something wrong happens when converting the virtual section name to real section name.")
    })

    this.symbolTable = new SymbolTable(symbols)
    this.sectionTable = new SectionTable(sections)
  }

  private microcontrollerAddresses(symbolNames: string[]) {
    const elf = new Elf( fs.readFileSync(CONSTANTS.DEVICE_ELF_PATH));
    const symbolNamesSet = new Set(symbolNames);
    if (elf.symbolNameSectionHeader === null) {
      throw new Error("section header of symbol names does not exist.");
    }
    const symNameShOffset = elf.symbolNameSectionHeader.shOffset;

    const result: {[name: string]: number} = {};
    elf.symbols.forEach(elfSymbol => {
      const elfSymbolName = elf.getStringFromBuffer(symNameShOffset + elfSymbol.stName);
      if (symbolNamesSet.has(elfSymbolName)) {
        result[elfSymbolName] = elfSymbol.stValue;
      }
    })
    return result;
  }
}


class SymbolTable {
  private elements: {[name: string]: number}

  constructor(symbols: {[name: string]: number}) {
    this.elements = symbols
  }

  public record(symbols: {[name: string]: number}) {
    this.elements = Object.assign(this.elements, symbols)
  }

  public symbols() { return this.elements }
}


class SectionTable {
  private readonly elements: {[name: string]: number} = {}

  constructor(initialAddresses: {[name: string]: number}) {
    this.elements = initialAddresses
  }

  public recordUsedMemory(usedMemories: {[name: string]: number}) {
    for (const name of Object.keys(usedMemories)) {
      this.elements[name] += usedMemories[name]
    }
  }

  public sections() { return this.elements }
}