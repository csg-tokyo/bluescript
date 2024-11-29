import {ExecutableElfReader, RelocatableElfReader, Symbol} from "./elf-reader";
import {FILE_PATH} from "../constants";
import {execSync} from "child_process";
import * as fs from "fs";
import {LinkerScript} from "./linker-script";
import {Buffer} from "node:buffer";


export type MemoryAddresses = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  flash:{address:number, size:number},
}


type MemoryUpdate = {
  iram: {address: number, data: string},
  dram: {address: number, data: string},
  flash: {address: number, data: string},
  entryPoint: number|undefined
}


export class ShadowMemory {
  private iram: MemoryRegion;
  private dram: MemoryRegion;
  private flash: MemoryRegion;
  private symbols:Map<string, Symbol> = new Map<string, Symbol>();
  private updates: MemoryUpdate[] = [];

  private componentsInfo = new ESPIDFComponentsInfo();

  constructor(bsRuntimePath: string, addresses: MemoryAddresses) {
    const bsRuntime = new ExecutableElfReader(bsRuntimePath);
    bsRuntime.readAllSymbols().forEach(symbol => {this.symbols.set(symbol.name, symbol)});
    this.iram = new MemoryRegion('IRAM', addresses.iram.address, addresses.iram.size);
    this.dram = new MemoryRegion('DRAM', addresses.dram.address, addresses.dram.size);
    this.flash = new MemoryRegion('Flash', addresses.flash.address, addresses.flash.size);
  }

  public loadAndLink(objFilePath: string, entryPointName: string, useFlash: boolean) {
    const objFile = new RelocatableElfReader(objFilePath);
    const externalSymbols:Symbol[] = [];
    objFile.readExternalSymbolNames().forEach(name => {
      const symbol = this.symbols.get(name);
      if (symbol !== undefined)
        externalSymbols.push(symbol);
    });

    const linkerScript = new LinkerScript(this.iram, this.dram, this.flash, useFlash)
    linkerScript.setInputFiles([objFilePath])
    linkerScript.setTarget(objFilePath, entryPointName)
    linkerScript.setExternalSymbols(externalSymbols)
    linkerScript.save(FILE_PATH.LINKER_SCRIPT)

    this.link(FILE_PATH.LINKER_SCRIPT, FILE_PATH.LINKED_ELF)
    this.load(FILE_PATH.LINKED_ELF, entryPointName)
  }

  public loadAndLinkModule(moduleName: string, entryPointName: string) {
    const linkerScript = new LinkerScript(this.iram, this.dram, this.flash, true)
    linkerScript.setInputFiles(this.componentsInfo.getComponentsPath(moduleName))
    linkerScript.setExternalSymbols(Array.from(this.symbols.values()))
    linkerScript.setTarget(this.componentsInfo.getComponentPath(moduleName), entryPointName)
    linkerScript.save(FILE_PATH.LINKER_SCRIPT);

    this.link(FILE_PATH.LINKER_SCRIPT, FILE_PATH.LINKED_ELF)
    this.load(FILE_PATH.LINKED_ELF, entryPointName)
  }

  private load(executableFile: string, entryPointName: string) {
    const executableElf = new ExecutableElfReader(executableFile);
    const emptySection = {size:0, value: Buffer.allocUnsafe(0)};
    const iramSection = executableElf.readSection(LinkerScript.IRAM_SECTION) ?? {address:this.iram.getNextAddress(), ...emptySection};
    const dramSection = executableElf.readSection(LinkerScript.DRAM_SECTION) ?? {address:this.dram.getNextAddress(), ...emptySection};
    const flashSection = executableElf.readSection(LinkerScript.FLASH_SECTION) ?? {address:this.flash.getNextAddress(), ...emptySection};

    this.iram.setUsed(iramSection.size)
    this.dram.setUsed(dramSection.size)
    this.flash.setUsed(flashSection.size)

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

  private link(linkerScript: string, outputPath: string) {
    execSync(`xtensa-esp32-elf-ld -o ${outputPath} -T ${linkerScript} --gc-sections`)
  }

  public getUpdates() {
    const updates = this.updates;
    this.updates = [];
    return updates;
  }
}


export class MemoryRegion {
  private readonly name: string
  private readonly address: number
  private readonly size: number
  private used: number = 0

  constructor(name: string, address: number, size: number) {
    this.name = name
    this.address = address
    this.size = size
  }

  public getRemainingSize() {
    return this.size - this.used
  }

  public getNextAddress() {
    return this.address + this.used
  }

  public setUsed(used: number) {
    if (this.used + used > this.size)
      throw new Error(`${this.name}: Memory Exhausted.`)
    this.used += used
  }
}


class ESPIDFComponentsInfo {
  static DEPENDENCIES_FILE_PATH = '../microcontroller/ports/esp32/build/project_description.json'
  static COMPONENTS_PATH_PREFIX = /^.*microcontroller\/ports\/esp32\/build/
  static RELATIVE_PATH_COMMON = '../microcontroller/ports/esp32/build'

  private dependenciesInfo: {[key: string]: {file: string, reqs: string[], priv_reqs: string[]}}

  constructor() {
    this.dependenciesInfo = JSON.parse(fs.readFileSync(ESPIDFComponentsInfo.DEPENDENCIES_FILE_PATH).toString()).build_component_info
  }

  public getComponentsPath(rootComponent: string): string[] {
    let tmp = [rootComponent]
    let visited = new Set<string>()
    const componentPaths:string[] = []
    while(tmp.length > 0) {
      let curr = tmp.shift() as string
      visited.add(curr)
      tmp = tmp.concat(
        this.dependenciesInfo[curr].priv_reqs.filter((r:string) => !visited.has(r)),
        this.dependenciesInfo[curr].reqs.filter((r:string) => !visited.has(r))
      )
      if (this.dependenciesInfo[curr].file !== undefined && this.dependenciesInfo[curr].file !== '')
        componentPaths.push(this.convertAbsoluteToRelative(this.dependenciesInfo[curr].file))
    }
    return componentPaths
  }

  public getComponentPath(componentName: string) {
    return this.convertAbsoluteToRelative(this.dependenciesInfo[componentName].file)
  }

  private convertAbsoluteToRelative(absolutePath: string) {
    return absolutePath.replace(ESPIDFComponentsInfo.COMPONENTS_PATH_PREFIX, ESPIDFComponentsInfo.RELATIVE_PATH_COMMON)
  }
}

