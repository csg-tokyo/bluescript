import {ElfReader, Section, Symbol} from "./elf-reader";
import * as fs from "fs";

const align4 = (value: number) => (value + 3) & ~3;

export type MemoryAddresses = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  flash:{address:number, size:number},
}

type MemoryUpdate = {
  blocks: {name: string, address: number, data: string}[],
  entryPoints: {id: number, address: number}[]
}

export class ShadowMemory {
  public readonly iram: ReusableMemoryRegion;
  public readonly dram: MemoryRegion;
  public readonly flash: MemoryRegion;
  public readonly symbols:Map<string, Symbol> = new Map<string, Symbol>();
  public readonly componentsInfo = new ESPIDFComponentsInfo();
  private updates: MemoryUpdate = {blocks: [], entryPoints: []};

  constructor(bsRuntimePath: string, addresses: MemoryAddresses) {
    const bsRuntime = new ElfReader(bsRuntimePath);
    bsRuntime.readAllSymbols().forEach(symbol => {this.symbols.set(symbol.name, symbol)});
    this.iram = new ReusableMemoryRegion('IRAM', addresses.iram.address, addresses.iram.size);
    this.dram = new MemoryRegion('DRAM', addresses.dram.address, addresses.dram.size);
    this.flash = new MemoryRegion('Flash', addresses.flash.address, addresses.flash.size);
  }

  load(id: number, sections: Section[], entryPoint: number) {
    sections.forEach(section => {
      this.updates.blocks.push({name: section.name, address: section.address, data: section.value.toString('hex')});
    });
    this.updates.entryPoints.push({id, address: entryPoint});
  }

  getUpdates() {
    const updates = this.updates;
    this.updates = {blocks: [], entryPoints: []};
    return updates;
  }
}


export class MemoryRegion {
  private usedSize: number = 0;
  constructor(private name: string, private address: number, private size: number) {}

  public getNextAddress() { return this.address + this.usedSize }

  public allocate(section: Section) {
    const alignedSectionSize = align4(section.size);
    if (this.usedSize + alignedSectionSize > this.size)
      throw new Error(`Memory exhausted: ${this.name}`)
    const memoryBlock = new MemoryBlock(this.address + this.usedSize, alignedSectionSize)
    memoryBlock.sectionName = section.name
    this.usedSize += alignedSectionSize
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
    const alignedSectionSize = align4(section.size);
    let current: undefined | MemoryBlock = this.memoryBlocks
    let allocatedBlock: undefined | MemoryBlock
    while(current !== undefined) {
      if (current.isFree && current.size > alignedSectionSize) {
        allocatedBlock = current
        current.separate(alignedSectionSize)
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


export class MemoryBlock {
  constructor(
    public address: number,
    public size: number,
    public isFree = true,
    public sectionName?: string,
    public prev?: MemoryBlock,
    public next?: MemoryBlock) {}

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


