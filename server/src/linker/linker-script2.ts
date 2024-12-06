import * as fs from "fs";
import {Buffer} from "node:buffer";
import {SECTION_TYPE} from "./elf-reader";


export type LinkerScriptMemoryBlock = {
  blockName: string,
  address: number,
  attributes: SECTION_TYPE[],
  outputSectionName: string,
  includedSection?: {objFile: string, sectionName: string},
  keptSection?: {objFile: string, sectionName: string}
}

export const DEFAULT_DATA_SECTIONS = '(.data .data.* .rodata .rodata.* .bss .bss.* .dram*)'
export const DEFAULT_TEXT_SECTIONS = '(.literal .text .literal.* .text.* .iram*)'


export class LinkerScript {
  private memoryBlocks: LinkerScriptMemoryBlock[];
  private inputFiles: string[];
  private entryPointName: string;
  private externalSymbols: {name: string, address: number}[] = [];

  constructor(memoryBlocks: LinkerScriptMemoryBlock[], inputFiles: string[], entryPointName: string) {
    this.memoryBlocks = memoryBlocks
    this.inputFiles = inputFiles
    this.entryPointName = entryPointName
  }

  public setExternalSymbols(symbols: {name: string, address: number}[]) {
    this.externalSymbols = symbols;
  }

  public save(path: string) {
    const str = this.getStr();
    fs.writeFileSync(path, Buffer.from(str));
  }


  private getStr() {
    return `
INPUT(${this.inputFiles.join(' ')})    
    
MEMORY {
    ${this.memoryBlocks.map(block => `${block.blockName} (${this.memoryAttributesToStr(block.attributes)}) : ORIGIN = 0x${block.address.toString(16)}, LENGTH = 10M`).join('\n\t')}
    EXTERNAL_SYMBOLS  (rx)   : ORIGIN = 0x0000, LENGTH = 100000M
}

SECTIONS {
    ${this.memoryBlocks.map(this.memoryBlockToSectionStr).join('\n\t')}
    
    .external_symbols : {
        ${this.externalSymbols.map(symbol => `${symbol.name} = 0x${symbol.address.toString(16)};\n\t\t`).join("")}
    } > EXTERNAL_SYMBOLS
}

ENTRY(${this.entryPointName})

`
  }

  private memoryBlockToSectionStr(block: LinkerScriptMemoryBlock) {
    return `
    ${block.outputSectionName} : {
        . = 0x00000000;
        ${block.includedSection && `${block.includedSection?.objFile}(${block.includedSection?.sectionName})`}
        ${block.keptSection && `KEEP(${block.keptSection?.objFile}(${block.keptSection?.sectionName}))`}
    } > ${block.blockName}
    `
  }

  private memoryAttributesToStr(attrs: SECTION_TYPE[]) {
    const attrToStr = (attr: SECTION_TYPE) => {
      switch (attr) {
        case SECTION_TYPE.READABLE:
          return 'r'
        case SECTION_TYPE.WRITABLE:
          return 'w'
        case SECTION_TYPE.EXECUTABLE:
          return 'x'
        default:
          return ''
      }
    }
    return attrs.map(attrToStr).join('')
  }
}
