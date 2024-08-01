import {ExecutableElfReader, RelocatableElfReader, SECTION_TYPE, Symbol} from "./elf-reader";
import {FILE_PATH} from "../constants";
import {LinkerScript} from "./linker-script";
import {execSync} from "child_process";

export type MemoryInfo = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  flash:{address:number, size:number}
}


type MemoryUnit = {
  address: number,
  size: number,
  used: number
}

export class ShadowMemory {
  private iram: MemoryUnit;
  private dram: MemoryUnit;
  private flash: MemoryUnit;
  private symbols:Map<string, Symbol> = new Map<string, Symbol>();

  constructor(bsRuntimePath: string, memoryInfo: MemoryInfo) {
    const bsRuntime = new ExecutableElfReader(bsRuntimePath);
    bsRuntime.readDefinedSymbols().forEach(symbol => {this.symbols.set(symbol.name, symbol)});
    this.iram = {...memoryInfo.iram, used:0};
    this.dram = {...memoryInfo.dram, used:0};
    this.flash = {...memoryInfo.flash, used:0};
  }

  public loadAndLink(objFilePath: string, entryPointName: string, useFlash:boolean) {
    const relocatableElf = new RelocatableElfReader(objFilePath);
    const externalSymbols:Symbol[] = [];
    relocatableElf.readUndefinedSymbolNames().forEach(name => {
      const symbol = this.symbols.get(name);
      if (symbol !== undefined)
        externalSymbols.push(symbol);
    });

    // create linker script
    const linkerScript = new LinkerScript(
      this.iram.address + this.iram.used,
      this.dram.address + this.dram.used,
      this.flash.address + this.flash.used);
    linkerScript.externalSymbols = externalSymbols;
    console.log("executable", relocatableElf.readSectionNames(SECTION_TYPE.EXECUTABLE));
    console.log("writable", relocatableElf.readSectionNames(SECTION_TYPE.WRITABLE));
    console.log("readonly", relocatableElf.readSectionNames(SECTION_TYPE.READONLY));
    if (!useFlash) {
      linkerScript.sectionNamesInIram = relocatableElf.readSectionNames(SECTION_TYPE.EXECUTABLE);
      let dramSection = relocatableElf.readSectionNames(SECTION_TYPE.WRITABLE);
      dramSection = dramSection.concat(relocatableElf.readSectionNames(SECTION_TYPE.READONLY));
      linkerScript.sectionNamesInDram = dramSection;
    } else {
      linkerScript.sectionNamesInFlash = relocatableElf.readSectionNames(SECTION_TYPE.EXECUTABLE);
      let dramSection = relocatableElf.readSectionNames(SECTION_TYPE.WRITABLE);
      dramSection = dramSection.concat(relocatableElf.readSectionNames(SECTION_TYPE.READONLY));
      linkerScript.sectionNamesInDram = dramSection;
    }
    linkerScript.save(FILE_PATH.LINKER_SCRIPT);

    // link
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-ld -o ${FILE_PATH.LINKED_ELF} -T ${FILE_PATH.LINKER_SCRIPT} ${FILE_PATH.OBJ_FILE}`)

    // get linked elf32.
    const executableElf = new ExecutableElfReader(FILE_PATH.LINKED_ELF);
    const emptySection = {size:0, value: Buffer.allocUnsafe(0)};
    const iramSection = executableElf.readSection(linkerScript.IRAM_SECTION) ?? {address:this.iram.address+this.iram.used, ...emptySection};
    const dramSection = executableElf.readSection(linkerScript.DRAM_SECTION) ?? {address:this.dram.address+this.dram.used, ...emptySection};
    const flashSection = executableElf.readSection(linkerScript.FLASH_SECTION) ?? {address:this.flash.address+this.flash.used, ...emptySection};

    this.iram.used += iramSection.size;
    this.dram.used += dramSection.size;
    this.flash.used += flashSection.size;

    executableElf.readDefinedSymbols().forEach(symbol => {
      this.symbols.set(symbol.name, symbol);
    });

    const entryPoint = this.symbols.get(entryPointName)?.address;

    return {
      iram: {address: iramSection.address, data: iramSection.value.toString("hex")},
      dram: {address: dramSection.address, data: dramSection.value.toString("hex")},
      flash: {address: flashSection.address, data: flashSection.value.toString("hex")},
      entryPoint
    }
  }
}


