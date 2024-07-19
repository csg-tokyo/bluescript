import * as fs from "fs";
import {Buffer} from "node:buffer";

export class LinkerScript {

  public iramAddress: number;
  public dramAddress: number;
  public sectionNamesInIram: string[] = [];
  public sectionNamesInDram: string[] = [];
  public externalSymbols: {name:string, address: number}[] = [];

  constructor(iramAddress: number, dramAddress: number) {
    this.iramAddress = iramAddress;
    this.dramAddress = dramAddress;
  }

  public save(path: string) {
    const str = this.getStr();
    fs.writeFileSync(path, Buffer.from(str));
  }

  private getStr() {
    return `
MEMORY {
    IRAM   (rwx)  : ORIGIN = 0x${this.iramAddress.toString(16)}, LENGTH = 1M
    DRAM   (rx)   : ORIGIN = 0x${this.dramAddress.toString(16)}, LENGTH = 1M
    DUMMY  (rwx)  : ORIGIN = 0x0000, LENGTH = 1000M
}

SECTIONS {
    .text : {
        . = 0x00000000;
        */code.o (${this.sectionNamesInIram.join(" ")})
    } > IRAM
    
    .data : {
        . = 0x00000000;
        */code.o (${this.sectionNamesInDram.join(" ")})
    } > DRAM

    .dummy : {
        ${this.externalSymbols.map(symbol => `${symbol.name} = 0x${symbol.address.toString(16)};\n`).join("")}
    } > DUMMY
}
`
  }
}

export class LinkerScriptForFlash {
  public flashAddress: number;
  public dramAddress: number;
  public writeSectionNames: string[] = [];
  public executeSectionNames: string[] = [];
  public rodataSectionNames: string[] = [];
  public externalSymbols: {name: string, address: number}[] = [];

  constructor(flashAddress: number, dramAddress: number) {
    this.flashAddress = flashAddress;
    this.dramAddress = dramAddress;
  }

  public save(path: string) {
    const str = this.getStr();
    fs.writeFileSync(path, Buffer.from(str));
  }

  private getStr() {
    return `
MEMORY {
    FLASH             (rx)  : ORIGIN = 0x${this.flashAddress.toString(16)}, LENGTH = 1M
    DRAM             (rwx)  : ORIGIN = 0x${this.dramAddress.toString(16)},  LENGTH = 1M
    EXTERNAL_SYMBOLS  (rx)  : ORIGIN = 0x0000, LENGTH = 1000M
}

SECTIONS {
    .text : {
        . = 0x00000000;
        */code.o (${this.executeSectionNames.join(" ")})
    } > FLASH
    
    .rodata : {
        . = 0x00000000;
        */code.o (${this.rodataSectionNames.join(" ")})
    } > FLASH
    
    .data : {
        . = 0x00000000;
        */code.o (${this.writeSectionNames.join(" ")})
    } > DRAM

    .external_symbols : {
        ${this.externalSymbols.map(symbol => `${symbol.name} = 0x${symbol.address.toString(16)};\n`).join("")}
    } > EXTERNAL_SYMBOLS
}
`
  }
}
