import {ElfReader, Section, Symbol} from "./elf-reader";
import * as fs from "fs";

const align4 = (value: number) => (value + 3) & ~3;

export type MemoryAddresses = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  iflash:{address:number, size:number},
  dflash:{address:number, size:number},
}

type MemoryType = 'iram' | 'dram' | 'iflash' | 'dflash';

type MemoryUpdate = {
  blocks: {type: MemoryType, address: number, data: string}[],
  entryPoints: {id: number, address: number}[]
}

type compileIdT = number;
type sectionIdT = number;

export class ShadowMemory {
  public readonly iram: ReusableMemoryRegion;
  public readonly dram: MemoryRegion;
  public readonly flash: MemoryRegion;
  public readonly symbols:Map<string, Symbol> = new Map<string, Symbol>();
  public readonly componentsInfo = new ESPIDFComponentsInfo();
  private updates: MemoryUpdate = {blocks: [], entryPoints: []};
  private freeableIramSection: Map<compileIdT, sectionIdT[]> = new Map();

  constructor(bsRuntimePath: string, addresses: MemoryAddresses) {
    const bsRuntime = new ElfReader(bsRuntimePath);
    bsRuntime.readAllSymbols().forEach(symbol => {this.symbols.set(symbol.name, symbol)});
    this.iram = new ReusableMemoryRegion('IRAM', addresses.iram.address, addresses.iram.size);
    this.dram = new MemoryRegion('DRAM', addresses.dram.address, addresses.dram.size);
    this.flash = new MemoryRegion('Flash', addresses.iflash.address, addresses.iflash.size);
  }

  freeIram(compileId: compileIdT) {
    const freeableSection = this.freeableIramSection.get(compileId);
    if (freeableSection === undefined)
      return;
    freeableSection.forEach(id => {
      this.iram.free(id);
    });
    this.freeableIramSection.delete(compileId);
  }

  setFreeableIramSection(compileId: compileIdT, sectionName: string) {
    const id = this.iram.sectionNameToId(sectionName);
    if (id === undefined)
      return;
    const current = this.freeableIramSection.get(compileId);
    if (current !== undefined)
      current.push(id);
    else
      this.freeableIramSection.set(compileId, [id]);
  }

  loadToIram(section: Section[]) { this.load(section, 'iram') }
  loadToDram(section: Section[]) { this.load(section, 'dram') }
  loadToIFlash(section: Section[]) { this.load(section, 'iflash') }

  private load(sections: Section[], type: MemoryType) {
    sections.forEach(section => {
      this.updates.blocks.push({
        address: section.address,
        data: section.value.toString('hex'),
        type
      });
    });
  }

  loadEntryPoint(id: number, entryPoint: number) { this.updates.entryPoints.push({id, address: entryPoint}); }

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
  private sectionId: sectionIdT

  constructor(name: string, address: number, size: number) {
    this.name = name
    this.memoryBlocks = new MemoryBlock(address, size)
    this.sectionId = 0
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
        current.sectionId = this.sectionId++
        break
      }
      current = current.next
    }
    if (allocatedBlock === undefined)
      throw new Error('Memory Exhausted')
    return allocatedBlock
  }

  public sectionNameToId(sectionName: string): sectionIdT | undefined {
    let current: undefined | MemoryBlock = this.memoryBlocks
    while(current !== undefined) {
      if (current.sectionName === sectionName) {
        return current.sectionId
      }
      current = current.next
    }
    return undefined
  }

  public free(sectionId: sectionIdT) {
    let current: undefined | MemoryBlock = this.memoryBlocks
    while(current !== undefined) {
      if (current.sectionId === sectionId) {
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
    public sectionId?: number,
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


