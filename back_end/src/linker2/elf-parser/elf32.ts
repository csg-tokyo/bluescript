import Elf32Shdr, {SHType} from "./elf32-shdr";
import Elf32Sym from "./elf32-sym";
import Elf32Rela from "./elf32-rela";
import {Buffer} from "node:buffer";
import Elf32Ehdr from "./elf32-ehdr";

export default class Elf32 {
  private readonly buffer: Buffer;

  public elfHeader: Elf32Ehdr;
  public shdrs: Elf32Shdr[];
  public symbols: Elf32Sym[];
  public relaTables: { [sectionName: string]: Elf32Rela[] }; // The key is name of relocation table section.

  // Special section header ids.
  public shstrtabId: number; // Index of section name section header in section headers.
  public strtabId: number; // Index of symbol name section header in section headers.
  public symtabId: number; // Index of symbol table section header in section headers.

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.elfHeader = new Elf32Ehdr(this.buffer);
    this.shdrs = extractShdrs(this.buffer, this.elfHeader);

    const specialIds = extractSpecialShdrIds(this.buffer, this.elfHeader, this.shdrs);
    this.shstrtabId = specialIds.shstrtabId;
    this.strtabId = specialIds.strtabId;
    this.symtabId = specialIds.symtabId;

    this.symbols = extractSymbols(this.buffer, this.shdrs, this.symtabId);
    this.relaTables = extractRelocationTables(this.buffer, this.shdrs, this.shstrtabId);
  }

  public getSymbolName(sym: Elf32Sym): string {
    const offset = this.shdrs[this.strtabId].shOffset + sym.stName;
    return extractString(this.buffer, offset);
  }

  public getSectionName(shdr: Elf32Shdr): string {
    const offset = this.shdrs[this.shstrtabId].shOffset + shdr.shName;
    return extractString(this.buffer, offset);
  }

  public copySectionValue(sectionName: string): Buffer {
    for (const shdr of this.shdrs) {
      const name = this.getSectionName(shdr);
      if (name === sectionName) {
        const value = Buffer.allocUnsafe(shdr.shSize);
        this.buffer.copy(value, 0, shdr.shOffset, shdr.shOffset + shdr.shSize);
        return value;
      }
    }
    return Buffer.from([]);
  }
}


function extractShdrs(buffer: Buffer, elfHeader: Elf32Ehdr): Elf32Shdr[] {
  const shdrs: Elf32Shdr[] = [];
  for (let i = 0; i < elfHeader.eShnum; i++) {
    const offset = elfHeader.eShoff + elfHeader.eShentsize * i
    const shdr = new Elf32Shdr(buffer, offset);
    shdrs.push(shdr);
  }
  return shdrs;
}


function extractSpecialShdrIds(buffer: Buffer, elfHeader: Elf32Ehdr, shdrs: Elf32Shdr[]) {
  const shstrtabId = elfHeader.eShstrndx;
  const shstrtab = shdrs[shstrtabId];
  const strtabId = shdrs.findIndex(shdr => extractString(buffer, shstrtab.shOffset + shdr.shName) == ".strtab");
  const symtabId = shdrs.findIndex(shdr => extractString(buffer, shstrtab.shOffset + shdr.shName) == ".symtab");
  return {shstrtabId, strtabId, symtabId};
}


function extractSymbols(buffer: Buffer, shdrs: Elf32Shdr[], symtabId: number) {
  const symtab = shdrs[symtabId];
  const symbols: Elf32Sym[] = [];
  const numOfSyms = symtab.shSize / symtab.shEntsize;
  for (let i = 0; i < numOfSyms; i++) {
    const offset = symtab.shOffset + symtab.shEntsize * i;
    const symbol = new Elf32Sym(buffer, offset);
    symbols.push(symbol);
  }
  return symbols;
}


function extractRelocationTables(buffer: Buffer, shdrs: Elf32Shdr[], shstrtabId: number) {
  const tables: { [sectionName: string]: Elf32Rela[] } = {};
  const relaShdrs = shdrs.filter(shdr => shdr.shType === SHType.SHT_RELA);
  const shstrtab = shdrs[shstrtabId];
  relaShdrs.forEach(shdr => {
    const sectionName = extractString(buffer, shstrtab.shOffset + shdr.shName);
    const relas: Elf32Rela[] = [];
    const numOfRelas = shdr.shSize / shdr.shEntsize;
    for (let i = 0; i < numOfRelas; i++) {
      const offset = shdr.shOffset + shdr.shEntsize * i;
      relas.push(new Elf32Rela(buffer, offset));
    }
    tables[sectionName] = relas;
  });
  return tables;
}


function extractString(buffer: Buffer, offset: number) {
  let end = offset;
  while (buffer[end] !== 0)
    end += 1;
  const stringBuffer = buffer.subarray(offset, end);
  return stringBuffer.toString();
}