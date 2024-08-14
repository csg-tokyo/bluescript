import * as fs from "fs";
import {Buffer} from "node:buffer";

export class LinkerScript {
  public readonly IRAM_SECTION: string = ".iram";
  public readonly DRAM_SECTION: string = ".dram";
  public readonly FLASH_SECTION: string = ".flash";

  public iramAddress: number;
  public dramAddress: number;
  public flashAddress: number;
  public sectionNamesInIram: string[] = [];
  public sectionNamesInDram: string[] = [];
  public sectionNamesInFlash: string[] = [];
  public externalSymbols: {name: string, address: number}[] = [];

  constructor(iramAddress:number, dramAddress:number, flashAddress:number) {
    this.iramAddress = iramAddress;
    this.dramAddress = dramAddress;
    this.flashAddress = flashAddress;
  }

  public save(path: string) {
    const str = this.getStr();
    fs.writeFileSync(path, Buffer.from(str));
  }

  private getStr() {
    return `
MEMORY {
    IRAM              (rwx)  : ORIGIN = 0x${this.iramAddress.toString(16)},  LENGTH = 1M
    DRAM              (rw)   : ORIGIN = 0x${this.dramAddress.toString(16)},  LENGTH = 1M              
    FLASH             (rwx)  : ORIGIN = 0x${this.flashAddress.toString(16)}, LENGTH = 1M
    EXTERNAL_SYMBOLS  (rx)   : ORIGIN = 0x0000, LENGTH = 1000M
}

SECTIONS {
    ${this.IRAM_SECTION} : {
        . = 0x00000000;
        ${this.sectionNamesInIram.length > 0 ? `*/code.o (${this.sectionNamesInIram.join(" ")})` : ""}
    } > IRAM
    
    ${this.DRAM_SECTION} : {
        . = 0x00000000;
        ${this.sectionNamesInDram.length > 0 ? `*/code.o (${this.sectionNamesInDram.join(" ")})` : ""}
    } > DRAM
    
    ${this.FLASH_SECTION} : {
        . = 0x00000000;
        ${this.sectionNamesInFlash.length > 0 ? `*/code.o (${this.sectionNamesInFlash.join(" ")})` : ""}
    } > FLASH

    .external_symbols : {
        ${this.externalSymbols.map(symbol => `${symbol.name} = 0x${symbol.address.toString(16)};\n\t\t`).join("")}
    } > EXTERNAL_SYMBOLS
}
`
  }
}
