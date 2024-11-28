import * as fs from "fs";
import {Buffer} from "node:buffer";
import {MemoryRegion} from "./shadow-memory";


export class LinkerScript {
  static readonly IRAM_SECTION: string = ".iram";
  static readonly DRAM_SECTION: string = ".dram";
  static readonly FLASH_SECTION: string = ".flash";

  private iram: MemoryRegion;
  private dram: MemoryRegion;
  private flash: MemoryRegion;
  private inputFiles: string[] = [];
  private entryPointName: string|undefined;
  private targetObjFilePath: string|undefined;
  private externalSymbols: {name: string, address: number}[] = [];
  private readonly useFlash: boolean

  constructor(iram: MemoryRegion, dram: MemoryRegion, flash: MemoryRegion, useFlash: boolean) {
    this.iram = iram
    this.dram = dram
    this.flash = flash
    this.useFlash = useFlash
  }

  public setTarget(objFile: string, entryPoint: string) {
    this.targetObjFilePath = objFile;
    this.entryPointName = entryPoint;
  }

  public setExternalSymbols(symbols: {name: string, address: number}[]) {
    this.externalSymbols = symbols;
  }

  public setInputFiles(files: string[]) {
    if (files.filter(f => !f.endsWith('.a') && !f.endsWith('.o')).length > 0)
        throw new Error('Linker Script: the input file should be object file or archive file')
    this.inputFiles = files
  }

  public save(path: string) {
    const str = this.getStr();
    fs.writeFileSync(path, Buffer.from(str));
  }

  private getStr() {
    return `
INPUT(${this.inputFiles.join(' ')})    
    
MEMORY {
    IRAM   (x)   : ORIGIN = 0x${this.iram.getNextAddress().toString(16)},  LENGTH = 1M
    DRAM   (rw)   : ORIGIN = 0x${this.dram.getNextAddress().toString(16)},  LENGTH = 1M        
    FLASH  (x)  : ORIGIN = 0x${this.flash.getNextAddress().toString(16)}, LENGTH = 1000M 
    EXTERNAL_SYMBOLS  (rx)   : ORIGIN = 0x0000, LENGTH = 100000M
}

SECTIONS {
    ${ this.useFlash ? 
      `
    ${LinkerScript.FLASH_SECTION} : {
        . = 0x00000000;
        *(.literal .text .literal.* .text.* .iram*)
        KEEP(${this.targetObjFilePath}(.literal .text .literal.* .text.* .iram*))
    } > FLASH
      ` : `
    ${LinkerScript.IRAM_SECTION} : {
        . = 0x00000000;
        *(.literal .text .literal.* .text.* .iram*)
        KEEP(${this.targetObjFilePath}(.literal .text .literal.* .text.* .iram*))
    } > IRAM
      `
    }
    
    ${LinkerScript.DRAM_SECTION} : {
        . = 0x00000000;
        *(.data .data.* .rodata .rodata.* .bss .bss.* .dram*)
        KEEP(${this.targetObjFilePath}(.data .data.* .rodata .rodata.* .bss .bss.* .dram*))
    } > DRAM

    .external_symbols : {
        ${this.externalSymbols.map(symbol => `${symbol.name} = 0x${symbol.address.toString(16)};\n\t\t`).join("")}
    } > EXTERNAL_SYMBOLS
}

ENTRY(${this.entryPointName})

`
  }
}
