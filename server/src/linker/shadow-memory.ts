import {ExecutableElfReader, RelocatableElfReader, SECTION_TYPE, Symbol} from "./elf-reader";
import {FILE_PATH} from "../constants";
import {LinkerScript} from "./linker-script";
import {execSync} from "child_process";
import * as fs from "fs";
import {LinkerScript2} from "./linker-script2";
import {Buffer} from "node:buffer";

const componentsPath = '/Users/maejimafumika/Desktop/Lab/research/bluescript/microcontroller/ports/esp32/build/esp-idf/'
const targetObjFilePath = '../microcontroller/ports/esp32/build/esp-idf/gpio_103112105111/libgpio_103112105111.a'

const dependenciesJsonPath = '../microcontroller/ports/esp32/build/project_description.json'

export type MemoryInfo = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  flash:{address:number, size:number},
  useFlash: boolean
}

type MemoryUnit = {
  address: number,
  size: number,
  used: number
}

type MemoryUpdate = {
  iram: {address: number, data: string},
  dram: {address: number, data: string},
  flash: {address: number, data: string},
  entryPoint: number|undefined
}

export class ShadowMemory {
  private iram: MemoryUnit;
  private dram: MemoryUnit;
  private flash: MemoryUnit;
  private symbols:Map<string, Symbol> = new Map<string, Symbol>();
  private useFlash: boolean;
  private updates: MemoryUpdate[] = [];

  // TODO: shouldBeDeleted
  private bsRuntime: ExecutableElfReader

  constructor(bsRuntimePath: string, memoryInfo: MemoryInfo) {
    this.bsRuntime = new ExecutableElfReader(bsRuntimePath);
    this.bsRuntime.readDefinedSymbols().forEach(symbol => {this.symbols.set(symbol.name, symbol)});
    this.iram = {...memoryInfo.iram, used:0};
    this.dram = {...memoryInfo.dram, used:0};
    this.flash = {...memoryInfo.flash, used:0};
    this.useFlash = memoryInfo.useFlash;
  }

  public loadAndLink(objFilePath: string, entryPointName: string) {
    const relocatableElf = new RelocatableElfReader(objFilePath);
    const externalSymbols:Symbol[] = [];
    relocatableElf.readUndefinedSymbolNames().forEach(name => {
      const symbol = this.symbols.get(name);
      if (symbol !== undefined)
        externalSymbols.push(symbol);
    });

    // create linker script
    const linkerScript = new LinkerScript(
      objFilePath,
      this.iram.address + this.iram.used,
      this.dram.address + this.dram.used,
      this.flash.address + this.flash.used);
    linkerScript.externalSymbols = externalSymbols;
    if (!this.useFlash) {
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
    execSync(`xtensa-esp32-elf-ld -o ${FILE_PATH.LINKED_ELF} -T ${FILE_PATH.LINKER_SCRIPT} ${objFilePath}`)

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

    this.updates.push( {
      iram: {address: iramSection.address, data: iramSection.value.toString("hex")},
      dram: {address: dramSection.address, data: dramSection.value.toString("hex")},
      flash: {address: flashSection.address, data: flashSection.value.toString("hex")},
      entryPoint
    })
  }

  public loadAndLinkForImport(entryPointName: string) {
    // create linker script
    let components = this.getComponentPaths('gpio_103112105111')
    const linkerScript = new LinkerScript2(
      this.dram.address + this.dram.used,
      this.flash.address + this.flash.used,
      components
    )
    linkerScript.setExternalSymbols(this.bsRuntime.getAllSymbols())
    linkerScript.setTarget(componentsPath + 'gpio_103112105111/libgpio_103112105111.a', entryPointName)
    linkerScript.save(FILE_PATH.LINKER_SCRIPT);

    // link
    execSync(`xtensa-esp32-elf-ld -o ${FILE_PATH.LINKED_ELF} -T ${FILE_PATH.LINKER_SCRIPT} --gc-sections`)

    // get linked elf32.
    const executableElf = new ExecutableElfReader(FILE_PATH.LINKED_ELF);
    const emptySection = {size:0, value: Buffer.allocUnsafe(0)};
    const iramSection = {address:this.iram.address+this.iram.used, ...emptySection};
    const dramSection = executableElf.readSection(linkerScript.DRAM_SECTION) ?? {address:this.dram.address+this.dram.used, ...emptySection};
    const flashSection = executableElf.readSection(linkerScript.FLASH_SECTION) ?? {address:this.flash.address+this.flash.used, ...emptySection};

    this.iram.used += iramSection.size;
    this.dram.used += dramSection.size;
    this.flash.used += flashSection.size;

    executableElf.readDefinedSymbols().forEach(symbol => {
      this.symbols.set(symbol.name, symbol);
    });

    const entryPoint = this.symbols.get(entryPointName)?.address;

    this.updates.push({
      iram: {address: iramSection.address, data: iramSection.value.toString("hex")},
      dram: {address: dramSection.address, data: dramSection.value.toString("hex")},
      flash: {address: flashSection.address, data: flashSection.value.toString("hex")},
      entryPoint
    })
  }

  private getComponentPaths(targetComponent: string) {
    const dependenciesJson = JSON.parse(fs.readFileSync(dependenciesJsonPath).toString())
    const componentInfo = dependenciesJson.build_component_info
    let tmp = [targetComponent]
    let visited = new Set<string>()
    const componentPaths:string[] = []
    while(tmp.length > 0) {
      let curr = tmp.shift() as string
      visited.add(curr)
      tmp = tmp.concat(
        componentInfo[curr].priv_reqs.filter((r:string) => !visited.has(r)),
        componentInfo[curr].reqs.filter((r:string) => !visited.has(r))
      )
      if (componentInfo[curr].file !== undefined && componentInfo[curr].file !== '')
        componentPaths.push(componentInfo[curr].file)
    }
    return componentPaths
  }

  public getUpdates() {
    const updates = this.updates;
    this.updates = [];
    return updates;
  }
}


