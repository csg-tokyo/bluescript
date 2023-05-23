import Elf from "../../utils/elf-parser/elf";
import {Buffer} from "node:buffer";
import * as fs from 'fs';
import CONSTANTS from "../../constants";
import {DBSection} from "../../utils/db/model/db-section";

export default class DeviceData {
  elf: Elf;

  constructor() {
    const elfBytes: Buffer = fs.readFileSync(CONSTANTS.DEVICE_ELF_PATH);
    this.elf = new Elf(elfBytes);
  }

  // 各セクションがデバイス上で配置されるアドレスを返す。
  public getSections(): DBSection[] {
    const sections:DBSection[] = [];
    if (!this.elf.symbolNameSectionHeader) {
      throw Error("There is no symbol section name section header in elf file.");
    }
    for (const symbol of this.elf.symbols) {
      const symbolNameStart = this.elf.symbolNameSectionHeader.shOffset + symbol.stName;
      switch (this.elf.getStringFromBuffer(symbolNameStart)) {
        case CONSTANTS.DD_TEXT_SECTION_NAME:
          sections.push({name:"text", address: symbol.stValue + CONSTANTS.DD_LITERAL_SECTION_SIZE, baseAddress: symbol.stValue + CONSTANTS.DD_LITERAL_SECTION_SIZE});
          sections.push({name: "literal", address: symbol.stValue, baseAddress: symbol.stValue});
          break;
        case CONSTANTS.DD_DATA_SECTION_NAME:
          sections.push({name: "data", address: symbol.stValue, baseAddress: symbol.stValue});
          break;
        case CONSTANTS.DD_RODATA_SECTION_NAME:
          sections.push({name: "rodata", address: symbol.stValue, baseAddress: symbol.stValue});
          break;
        case CONSTANTS.DD_BSS_SECTION_NAME:
          sections.push({name: "bss", address: symbol.stValue, baseAddress:symbol.stValue});
          break
        default:
          break;
      }
    }
    return sections;
  }

  // 与えられたシンボル名のシンボルたちのデバイス上でのアドレスを返す。
  public getSymbolAddresses(symbolNames: string[]): {[name: string]: number} {
    const symbolNamesSet = new Set(symbolNames);
    if (this.elf.symbolNameSectionHeader === null) {
      throw new Error("section header of symbol names does not exist.");
    }
    const symNameShOffset = this.elf.symbolNameSectionHeader.shOffset;

    const result: {[name: string]: number} = {};
    this.elf.symbols.forEach(elfSymbol => {
      const elfSymbolName = this.elf.getStringFromBuffer(symNameShOffset + elfSymbol.stName);
      if (symbolNamesSet.has(elfSymbolName)) {
        result[elfSymbolName] = elfSymbol.stValue;
      }
    })
    return result;
  }
}