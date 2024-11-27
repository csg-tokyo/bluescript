import * as fs from "fs";
import {Buffer} from "node:buffer";

export class LinkerScript2 {
  // public readonly IRAM_SECTION: string = ".iram";
  public readonly DRAM_SECTION: string = ".dram";
  public readonly FLASH_SECTION: string = ".flash";

  // public iramAddress: number;
  private dramAddress: number;
  private flashAddress: number;
  private inputObjFiles: string[] = [];
  private entryPointName: string|undefined;
  private targetObjFilePath: string|undefined;
  private externalSymbols: {name: string, address: number}[] = [];

  constructor(dramAddress:number, flashAddress:number, inputObjFiles: string[]) {
    this.dramAddress = dramAddress;
    this.flashAddress = flashAddress;
    this.inputObjFiles = inputObjFiles;
  }

  public setTarget(objFile: string, entryPoint: string) {
    this.targetObjFilePath = objFile;
    this.entryPointName = entryPoint;
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
INPUT(${this.inputObjFiles.join(' ')})    
    
MEMORY {
    DRAM              (rw)   : ORIGIN = 0x${this.dramAddress.toString(16)},  LENGTH = 1M              
    FLASH             (x)  : ORIGIN = 0x${this.flashAddress.toString(16)}, LENGTH = 1M
    EXTERNAL_SYMBOLS  (rx)   : ORIGIN = 0x0000, LENGTH = 10000M
}

SECTIONS {
    ${this.FLASH_SECTION} : {
        . = 0x00000000;
        *(.literal .text .literal.* .text.* )
        KEEP(${this.targetObjFilePath}(.literal .text .literal.* .text.* ))
    } > FLASH
    
    ${this.DRAM_SECTION} : {
        . = 0x00000000;
        *(.data .data.* .rodata .rodata.* .bss .bss.* .dram*)
        KEEP(${this.targetObjFilePath}(.data .data.* .rodata .rodata.* .bss .bss.*))
    } > DRAM

    .external_symbols : {
        ${this.externalSymbols.map(symbol => `${symbol.name} = 0x${symbol.address.toString(16)};\n\t\t`).join("")}
    } > EXTERNAL_SYMBOLS
}

ENTRY(${this.entryPointName})

`
  }
}
