import {ElfReader, Section, SECTION_TYPE, Symbol} from "./elf-reader";
import {FILE_PATH} from "../constants";
import {execSync} from "child_process";
import * as fs from "fs";
import {DEFAULT_DATA_SECTIONS, DEFAULT_TEXT_SECTIONS, LinkerScript, LinkerScriptMemoryBlock} from "./linker-script2";

export type MemoryAddresses = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  flash:{address:number, size:number},
}


type MemoryUpdate = {
  blocks: {address: number, data: string}[],
  entryPoints: number[]
}

const IRAM_OUTPUT_SECTION = '.iram'
const DRAM_OUTPUT_SECTION = '.dram'
const FLASH_OUTPUT_SECTION = '.flash'


export class ShadowMemory {
  private iram: ReusableMemoryRegion;
  private dram: UnreusableMemoryRegion;
  private flash: UnreusableMemoryRegion;
  private symbols:Map<string, Symbol> = new Map<string, Symbol>();
  private updates: MemoryUpdate = {blocks: [], entryPoints: []};

  private componentsInfo = new ESPIDFComponentsInfo();

  constructor(bsRuntimePath: string, addresses: MemoryAddresses) {
    const bsRuntime = new ElfReader(bsRuntimePath);
    bsRuntime.readAllSymbols().forEach(symbol => {this.symbols.set(symbol.name, symbol)});
    this.iram = new ReusableMemoryRegion('IRAM', addresses.iram.address, addresses.iram.size);
    this.dram = new UnreusableMemoryRegion('DRAM', addresses.dram.address, addresses.dram.size);
    this.flash = new UnreusableMemoryRegion('Flash', addresses.flash.address, addresses.flash.size);
  }

  public loadAndLink(objFilePath: string, entryPointName: string) {
    const objFile = new ElfReader(objFilePath);
    const externalSymbols:Symbol[] = [];
    objFile.readExternalSymbols().forEach(symbol => {
      const definedSymbol = this.symbols.get(symbol.name);
      if (definedSymbol !== undefined)
        externalSymbols.push(symbol);
    });

    const linkerScriptBlocks = this.createLinkerScriptBlocks(objFilePath, objFile)
    const linkerScript = new LinkerScript(linkerScriptBlocks, [objFilePath], entryPointName)
    linkerScript.setExternalSymbols(externalSymbols)
    linkerScript.save(FILE_PATH.LINKER_SCRIPT)

    this.link(FILE_PATH.LINKER_SCRIPT, FILE_PATH.LINKED_ELF)
    this.load(FILE_PATH.LINKED_ELF, linkerScriptBlocks.map(block => block.outputSectionName), entryPointName)
  }

  public loadAndLinkModule(moduleName: string, entryPointName: string) {
    const linkerScriptBlocks = this.createLinkerScriptBlocksForModule(moduleName)

    const linkerScript = new LinkerScript(linkerScriptBlocks, this.componentsInfo.getComponentsPath(moduleName), entryPointName)
    linkerScript.setExternalSymbols(Array.from(this.symbols.values()))
    linkerScript.save(FILE_PATH.LINKER_SCRIPT)

    this.linkWithGcSections(FILE_PATH.LINKER_SCRIPT, FILE_PATH.LINKED_ELF)
    this.load(FILE_PATH.LINKED_ELF, linkerScriptBlocks.map(block => block.outputSectionName), entryPointName)
  }

  public getUpdates() {
    const updates = this.updates;
    this.updates = {blocks: [], entryPoints: []};
    return updates;
  }

  private createLinkerScriptBlocks(objFilePath: string, objFile: ElfReader) {
    // The object file should be created with --ffunction-sections and -mtext-section-literals
    const executableSections = objFile.readSections(SECTION_TYPE.EXECUTABLE)
    executableSections.forEach(section => this.iram.free(section.name))
    let executableBlocks = executableSections.map(section => this.iram.allocate(section))
    const linkerScriptBlocks: LinkerScriptMemoryBlock[] = executableBlocks.map((block, i) => {
      return {
        blockName: `IRAM_${i}`,
        address: block.address,
        attributes: [SECTION_TYPE.EXECUTABLE],
        outputSectionName: `${IRAM_OUTPUT_SECTION}${i}`,
        includedSection: block.sectionName ? {objFile: objFilePath, sectionName: block.sectionName} : undefined,
      }
    })

    linkerScriptBlocks.push({
      blockName: `DRAM`,
      address: this.dram.getNextAddress(),
      attributes: [SECTION_TYPE.READONLY, SECTION_TYPE.WRITABLE],
      outputSectionName: DRAM_OUTPUT_SECTION,
      includedSection: {objFile: objFilePath, sectionName: DEFAULT_DATA_SECTIONS},
    })

    return linkerScriptBlocks
  }

  private createLinkerScriptBlocksForModule(moduleName: string) {
    const targetObjFile = this.componentsInfo.getComponentPath(moduleName)
    return [
      {
        blockName: `FLASH`,
        address: this.flash.getNextAddress(),
        attributes: [SECTION_TYPE.EXECUTABLE],
        outputSectionName: FLASH_OUTPUT_SECTION,
        includedSection: {objFile: targetObjFile, sectionName: DEFAULT_DATA_SECTIONS},
        keptSection: {objFile: targetObjFile, sectionName: DEFAULT_DATA_SECTIONS},
      },
      {
        blockName: `DRAM`,
        address: this.dram.getNextAddress(),
        attributes: [SECTION_TYPE.EXECUTABLE],
        outputSectionName: DRAM_OUTPUT_SECTION,
        includedSection: {objFile: targetObjFile, sectionName: DEFAULT_TEXT_SECTIONS},
        keptSection: {objFile: targetObjFile, sectionName: DEFAULT_TEXT_SECTIONS},
      }
    ]
  }

  private load(linkedElfPath: string, sectionNames: string[], entryPointName: string) {
    const linkedElf = new ElfReader(linkedElfPath);
    const blocks:{address: number, data: string}[] = []
    sectionNames.forEach(name => {
      const section = linkedElf.readSectionByName(name)
      if (section) {
        blocks.push({address: section.address, data: section.value.toString("hex")})
        if (name === FLASH_OUTPUT_SECTION || name === DRAM_OUTPUT_SECTION)
          this.flash.allocate(section.size)
      }
    })
    linkedElf.readDefinedSymbols().forEach(symbol => {
      this.symbols.set(symbol.name, symbol);
    });

    const entryPoint = this.symbols.get(entryPointName)?.address;
    if (entryPoint === undefined)
      throw new Error(`Cannot find entry point: ${entryPointName}`)

    this.updates.blocks.concat(blocks)
    this.updates.entryPoints.push(entryPoint)
  }

  private link(linkerScript: string, outputPath: string) {
    execSync(`xtensa-esp32-elf-ld -o ${outputPath} -T ${linkerScript}`)
  }

  private linkWithGcSections(linkerScript: string, outputPath: string) {
    execSync(`xtensa-esp32-elf-ld -o ${outputPath} -T ${linkerScript} --gc-sections`)
  }
}

export class UnreusableMemoryRegion {
  private name: string
  private address: number
  private size: number
  private usedSize: number

  constructor(name: string, address: number, size: number) {
    this.name = name
    this.address = address
    this.size = size
    this.usedSize = 0
  }

  public getNextAddress() { return this.address + this.size }

  public allocate(size: number) {
    if (this.usedSize + size > this.size)
      throw new Error(`Memory exhausted: ${this.name}`)
    const memoryBlock = new MemoryBlock(this.address + this.usedSize, size)
    this.usedSize += size
    return memoryBlock
  }
}


export class ReusableMemoryRegion {
  private name: string
  private memoryBlocks: MemoryBlock

  constructor(name: string, address: number, size: number) {
    this.name = name
    this.memoryBlocks = new MemoryBlock(address, size)
  }

  public allocate(section: Section) {
    let current: undefined | MemoryBlock = this.memoryBlocks
    let allocatedBlock: undefined | MemoryBlock
    while(current !== undefined) {
      if (current.isFree && current.size > section.size) {
        allocatedBlock = current
        current.separate(section.size)
        current.isFree = false
        current.sectionName = section.name
        break
      }
      current = current.next
    }
    if (allocatedBlock === undefined)
      throw new Error('Memory Exhausted')
    return allocatedBlock
  }

  public free(sectionName: string) {
    let current: undefined | MemoryBlock = this.memoryBlocks
    while(current !== undefined) {
      if (current.sectionName === sectionName) {
        current = current.free()
      }
      current = current.next
    }
  }
}


class MemoryBlock {
  address: number
  size: number
  isFree: boolean
  sectionName: string | undefined
  prev: MemoryBlock | undefined
  next: MemoryBlock | undefined

  constructor(address: number, size: number, isFree = true, sectionName?: string, prev?: MemoryBlock, next?: MemoryBlock) {
    this.address = address
    this.size = size
    this.isFree = isFree
    this.sectionName = sectionName
    this.prev = prev
    this.next = next
  }

  public free() {
    this.isFree = true
    this.sectionName = undefined
    if (this.next && this.next.isFree) {
      this.size += this.next.size
      if (this.next.next)
        this.next.next.prev = this
      this.next = this.next.next
    }
    if (this.prev && this.prev.isFree) {
      this.prev.size += this.size
      if (this.next)
        this.next.prev = this.prev
      this.prev.next = this.next
      return this.prev
    }
    return this
  }

  public separate(firstSize: number) {
    if (!this.isFree)
      throw new Error('Cannot separate first.')
    const remain = new MemoryBlock(this.address + firstSize, this.size - firstSize)
    remain.prev = this
    remain.next = this.next
    this.size = firstSize
    if (this.next)
      this.next.prev = remain
    this.next = remain
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

