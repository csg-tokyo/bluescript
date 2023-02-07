import Elf32BufferStream from "./elf32/elf32-buffer-stream";
import Elf32Ehdr from "./elf32/elf32-ehdr";
import Elf32Shdr from "./elf32/elf32-shdr";
import Elf32Sym from "./elf32/elf32-sym";
import {Elf32RelaTable} from "./elf32/elf32-rela";
import {Buffer} from "node:buffer";
import ELF_PARSER_CONSTANTS from "./static/elf-parser-constants";

export default class Elf {
  private readonly buffer: Buffer;
  elfHeader: Elf32Ehdr;
  sectionNameSectionHeader: Elf32Shdr;
  symbolNameSectionHeader: Elf32Shdr | null = null;
  sectionHeaders: Elf32Shdr[] = [];

  symbolSectionHeaderId: number | undefined;
  symbols: Elf32Sym[] = [];

  relaSectionHeaders: { id: number, shdr: Elf32Shdr }[] = [];
  relocationTables: Elf32RelaTable[] = [];

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    // Get elf header.
    const elfHeaderBuffer = this.buffer.subarray(0, Elf32Ehdr.SIZE);
    this.elfHeader = new Elf32Ehdr(new Elf32BufferStream(elfHeaderBuffer));
    // Get section header of section name section.
    const sectionNameSectionHeaderStart = this.elfHeader.eShoff + this.elfHeader.eShentsize * this.elfHeader.eShstrndx;
    const sectionNameSectionHeaderBuffer = this.buffer.subarray(sectionNameSectionHeaderStart, sectionNameSectionHeaderStart + this.elfHeader.eShentsize);
    this.sectionNameSectionHeader = new Elf32Shdr(new Elf32BufferStream(sectionNameSectionHeaderBuffer));

    this.setSectionHeaders();
    this.setSymbols();
    this.setRelocationTables();
  }

  private setSectionHeaders() {
    for (let i = 0; i < this.elfHeader.eShnum; i++) {
      const start = this.elfHeader.eShoff + this.elfHeader.eShentsize * i
      const sectionHeaderBuffer: Buffer = this.buffer.subarray(start, start + this.elfHeader.eShentsize);
      const sectionHeader = new Elf32Shdr(new Elf32BufferStream(sectionHeaderBuffer));
      this.sectionHeaders.push(sectionHeader);
      // Set relaSectionHeaders.
      if (sectionHeader.shType === ELF_PARSER_CONSTANTS.SHT_RELA) { // TODO:Add SHT_REL
        this.relaSectionHeaders.push({id: i, shdr: sectionHeader});
      }

      const sectionNameStart = this.sectionNameSectionHeader.shOffset + sectionHeader.shName;
      const sectionName = this.getStringFromBuffer(sectionNameStart);
      if (sectionName === ".strtab") {
        this.symbolNameSectionHeader = sectionHeader;
      }
      if (sectionName === ".symtab") {
        this.symbolSectionHeaderId = i;
      }
    }
  }

  private setSymbols() {
    if (this.symbolSectionHeaderId === undefined) {
      throw Error("This elf file doesn't have symbol table.")
    }
    const symbolSectionHeader = this.sectionHeaders[this.symbolSectionHeaderId];
    const symbolNum = symbolSectionHeader.shSize / symbolSectionHeader.shEntsize;
    for (let i = 0; i < symbolNum; i++) {
      const start = symbolSectionHeader.shOffset + symbolSectionHeader.shEntsize * i;
      const symbolBuffer = this.buffer.subarray(start, start + symbolSectionHeader.shEntsize);
      const symbol = new Elf32Sym(new Elf32BufferStream(symbolBuffer));
      this.symbols.push(symbol);
    }
  }

  private setRelocationTables() {
    this.relaSectionHeaders.forEach(relaSectionHeader => {
      const relaTable = new Elf32RelaTable(relaSectionHeader.id);
      const relaNum = relaSectionHeader.shdr.shSize / relaSectionHeader.shdr.shEntsize;
      for (let i = 0; i < relaNum; i++) {
        const start = relaSectionHeader.shdr.shOffset + relaSectionHeader.shdr.shEntsize * i;
        const relaBuffer = this.buffer.subarray(start, start + relaSectionHeader.shdr.shEntsize);
        relaTable.addRela(new Elf32BufferStream(relaBuffer));
      }
      this.relocationTables.push(relaTable);
    })
  }

  public getStringFromBuffer(start: number): string {
    let end = start;
    while (true) {
      if (this.buffer[end] === 0) {
        break;
      }
      end += 1;
    }
    const stringBuffer = this.buffer.subarray(start, end);
    return stringBuffer.toString();
  }

  public getSubBuffer(start: number, length: number): Buffer {
    return this.buffer.subarray(start, start + length);
  }

  public getSectionHeaderId(sectionName: string): number {
    for (let i = 0; i < this.sectionHeaders.length; i++) {
      const sectionNameStart = this.sectionNameSectionHeader.shOffset + this.sectionHeaders[i].shName;
      if (this.getStringFromBuffer(sectionNameStart) === sectionName) {
        return i;
      }
    }
    return -1;
  }

  public getSymbolId(symbolName: string) {
    if (!this.symbolNameSectionHeader) {
      return -1;
    }
    for (let i = 0; i < this.symbols.length; i++) {
      const symbolNameStart = this.symbolNameSectionHeader.shOffset  + this.symbols[i].stName;
      if (this.getStringFromBuffer(symbolNameStart) === symbolName) {
        return i;
      }
    }
    return -1;
  }
}