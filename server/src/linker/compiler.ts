import {MemoryBlock, MemoryRegion, ReusableMemoryRegion} from "./memory-region";
import {ElfReader, SECTION_TYPE, Symbol} from "./elf-reader";
import * as fs from "fs";
import {execSync} from "child_process";
import {
  LinerScriptMemoryAttribute,
  LinkerScript3,
  LinkerScriptMemoryRegion,
  LinkerScriptSection
} from "./linker-script3";


export type MemoryAddresses = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  flash:{address:number, size:number},
}

type MemoryUpdate = {
  blocks: {address: number, data: string, isFlash: boolean}[],
  entryPoints: number[]
}

const EXTERNAL_SYMBOL_SECTION = '.external_symbols'

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

  setUpdate(blocks: {address: number, data: string, isFlash: boolean}[], entryPoint: number) {
    this.updates.blocks = this.updates.blocks.concat(blocks);
    this.updates.entryPoints.push(entryPoint)
  }

  getUpdates() {
    const updates = this.updates;
    this.updates = {blocks: [], entryPoints: []};
    return updates;
  }
}


export class Compiler {
  private readonly C_FILE = './temp-files/code.c';
  private readonly OBJ_FILE = './temp-files/code.o';
  private readonly LINKER_SCRIPT = './temp-files/linkerscript.ld';
  private readonly LINKED_ELF = './temp-files/code';
  constructor(private compilerPath = '') {}

  compile(shadowMemory: ShadowMemory, src: string, entryPointName: string) {
    const objFile = this._compile(src);
    const linkedElf = this.link(shadowMemory, objFile, entryPointName);
    this.load(shadowMemory, linkedElf, entryPointName)
  }

  private _compile(src: string) {
    fs.writeFileSync(this.C_FILE, src);
    execSync(`${this.compilerPath}xtensa-esp32-elf-gcc -c -O2 ${this.C_FILE} -o ${this.OBJ_FILE} -w -fno-common -ffunction-sections -mtext-section-literals -mlongcalls`);
    return new ElfReader(this.OBJ_FILE);
  }

  private link(shadowMemory: ShadowMemory, objFile: ElfReader, entryPointName: string) {
    this.freeIram(shadowMemory, objFile);
    const memoryBlocks = this.allocate(shadowMemory, objFile);
    const externalSymbols = this.readExternalSymbols(shadowMemory, objFile);
    const linkerScript = this.generateLinkerScript(memoryBlocks.iram, memoryBlocks.dram, externalSymbols, objFile, entryPointName);
    const linkedElf = this._link(linkerScript);
    this.freeEntryPoint(shadowMemory, entryPointName);
    return linkedElf;
  }

  private _link(linkerScript: LinkerScript3) {
    linkerScript.save(this.LINKER_SCRIPT)
    execSync(`${this.compilerPath}xtensa-esp32-elf-ld -o ${this.LINKED_ELF} -T ${this.LINKER_SCRIPT}`);
    return new ElfReader(this.LINKED_ELF);
  }

  private load(shadowMemory: ShadowMemory, linkedElf: ElfReader, entryPointName: string) {
    const blocks = linkedElf
      .readAllSections()
      .filter(section => section.name !== EXTERNAL_SYMBOL_SECTION)
      .map(section => ({address: section.address, data: section.value.toString("hex"), isFlash: false}));
    linkedElf.readDefinedSymbols().forEach(symbol => {
      shadowMemory.symbols.set(symbol.name, symbol);
    });
    const entryPoint = shadowMemory.symbols.get(entryPointName)?.address;
    if (entryPoint === undefined)
      throw new Error(`Cannot find entry point: ${entryPointName}`);
    shadowMemory.setUpdate(blocks, entryPoint);
  }

  private readExternalSymbols(shadowMemory: ShadowMemory, objFile: ElfReader) {
    const externalSymbols: Symbol[] = [];
    objFile.readExternalSymbols().forEach(symbol => {
      const definedSymbol = shadowMemory.symbols.get(symbol.name);
      if (definedSymbol !== undefined)
        externalSymbols.push(definedSymbol);
    });
    return externalSymbols;
  }

  private generateLinkerScript(
    iramBlocks: MemoryBlock[], dramBlocks: MemoryBlock[],
    externalSymbols: Symbol[], objFile: ElfReader, entryPointName: string) {
    const memories: LinkerScriptMemoryRegion[] = [];
    const sections: LinkerScriptSection[] = [];
    const externalSymbolMemory = new LinkerScriptMemoryRegion(
      'EXTERNAL_SYMBOLS',
      [new LinerScriptMemoryAttribute('executable')],
      0, 0
    );
    const externalSymbolSection = new LinkerScriptSection(EXTERNAL_SYMBOL_SECTION, externalSymbolMemory);
    externalSymbols.forEach(symbol => {
      externalSymbolSection.symbol(symbol.name, symbol.address);
    });
    memories.push(externalSymbolMemory);
    sections.push(externalSymbolSection);

    iramBlocks.forEach((block , index) => {
      const memoryRegion = new LinkerScriptMemoryRegion(
        `IRAM${index}`,
        [new LinerScriptMemoryAttribute('executable')],
        block.address, block.size);
      const section = new LinkerScriptSection(`.iram${index}`, memoryRegion)
        .section(objFile.filePath, [block.sectionName ?? '']);
      memories.push(memoryRegion);
      sections.push(section);
    });
    dramBlocks.forEach((block , index) => {
      const memoryRegion = new LinkerScriptMemoryRegion(
        `DRAM${index}`,
        [new LinerScriptMemoryAttribute('read/write'), new LinerScriptMemoryAttribute('readonly')],
        block.address, block.size);
      const section = new LinkerScriptSection(`.dram${index}`, memoryRegion)
        .section(objFile.filePath, [block.sectionName ?? '']);
      memories.push(memoryRegion);
      sections.push(section);
    });

    return new LinkerScript3()
      .input([objFile.filePath])
      .entry(entryPointName)
      .memory(memories)
      .sections(sections)
  }

  private allocate(shadowMemory: ShadowMemory, objFile: ElfReader) {
    const executableSections = objFile.readSections(SECTION_TYPE.EXECUTABLE).filter(section => section.size !== 0);
    const dataSections = objFile.readSections(SECTION_TYPE.WRITABLE)
      .concat(objFile.readSections(SECTION_TYPE.READONLY))
      .filter(section => section.size !== 0);
    const iramMemoryBlock = executableSections.map(section => shadowMemory.iram.allocate(section));
    const dramMemoryBlock = dataSections.map(section => shadowMemory.dram.allocate(section));
    return {iram: iramMemoryBlock, dram: dramMemoryBlock};
  }

  private freeEntryPoint(shadowMemory: ShadowMemory, entryPointName: string) {
    shadowMemory.iram.free(this.funcNameToSectionName(entryPointName));
  }

  private freeIram(shadowMemory: ShadowMemory, objFile: ElfReader) {
    const funcSymbols = objFile.readFunctions();
    funcSymbols.forEach(symbol => {
      if (shadowMemory.symbols.has(symbol.name))
        shadowMemory.iram.free(this.funcNameToSectionName(symbol.name))
    })
  }

  private funcNameToSectionName(funcName: string) {
    return `.text.${funcName}`
  }
}

export class ModuleCompiler {
  private readonly LINKER_SCRIPT = './temp-files/module-linkerscript.ld';
  private readonly LINKED_ELF = './temp-files/module-code';
  private readonly EXECUTABLE_SECTIONS = ['.literal', '.text', '.literal.*', '.text.*', '.iram*'];
  private readonly DATA_SECTIONS = ['.data', '.data.*', '.rodata', '.rodata.*', '.bss', '.bss.*', '.dram*'];
  private readonly DRAM_SECTION_NAME = '.dram';
  private readonly FLASH_SECTION_NAME = '.flash';


  constructor(private compilerPath: string = '') {}

  compile(shadowMemory: ShadowMemory, moduleName: string, entryPointName: string) {
    const executableElf = this.link(shadowMemory, moduleName, entryPointName);
    this.load(shadowMemory, executableElf, entryPointName)
  }

  private link(shadowMemory: ShadowMemory, moduleName: string, entryPointName: string): ElfReader {
    const linkerScript = this.generateLinkerScript(shadowMemory, moduleName, entryPointName);
    const linkedElf = this._link(linkerScript);
    this.allocate(shadowMemory, linkedElf);
    return linkedElf;
  }

  private _link(linkerScript: LinkerScript3) {
    linkerScript.save(this.LINKER_SCRIPT);
    execSync(`${this.compilerPath}xtensa-esp32-elf-ld -o ${this.LINKED_ELF} -T ${this.LINKER_SCRIPT} --gc-sections`);
    return new ElfReader(this.LINKED_ELF);
  }

  private load(shadowMemory: ShadowMemory, linkedElf: ElfReader, entryPointName: string) {
    const dramSection = linkedElf.readSectionByName(this.DRAM_SECTION_NAME);
    const flashSection = linkedElf.readSectionByName(this.FLASH_SECTION_NAME);
    const blocks: {address: number, data: string, isFlash: boolean}[] = []
    if (dramSection !== undefined)
      blocks.push({address: dramSection.address, data: dramSection.value.toString("hex"), isFlash: false});
    if (flashSection !== undefined)
      blocks.push({address: flashSection.address, data: flashSection.value.toString("hex"), isFlash: true});
    linkedElf.readDefinedSymbols().forEach(symbol => {
      shadowMemory.symbols.set(symbol.name, symbol);
    });
    const entryPoint = shadowMemory.symbols.get(entryPointName)?.address;
    if (entryPoint === undefined)
      throw new Error(`Cannot find entry point: ${entryPointName}`);
    shadowMemory.setUpdate(blocks, entryPoint);
  }

  private allocate(shadowMemory: ShadowMemory, linkedElf: ElfReader) {
    const dramSection = linkedElf.readSectionByName(this.DRAM_SECTION_NAME);
    const flashSection = linkedElf.readSectionByName(this.FLASH_SECTION_NAME);
    if (dramSection !== undefined)
      shadowMemory.dram.allocate(dramSection);
    if (flashSection !== undefined)
      shadowMemory.flash.allocate(flashSection);
  }

  private generateLinkerScript(shadowMemory: ShadowMemory, moduleName: string, entryPointName: string) {
    const moduleObjFile = shadowMemory.componentsInfo.getComponentPath(moduleName)
    const dramMemory = new LinkerScriptMemoryRegion(
      'DRAM',
      [new LinerScriptMemoryAttribute('read/write'), new LinerScriptMemoryAttribute('readonly')],
      shadowMemory.dram.getNextAddress(),
      1000000);
    const flashMemory = new LinkerScriptMemoryRegion(
      'FLASH',
      [new LinerScriptMemoryAttribute('executable')],
      shadowMemory.flash.getNextAddress(),
      1000000);
    const externalSymbolMemory = new LinkerScriptMemoryRegion(
      'EXTERNAL_SYMBOLS',
      [new LinerScriptMemoryAttribute('executable')],
      0, 0)
    const memories = [dramMemory, flashMemory, externalSymbolMemory];
    const externalSymbolSection = new LinkerScriptSection(EXTERNAL_SYMBOL_SECTION, externalSymbolMemory);
    shadowMemory.symbols.forEach(symbol => {
      externalSymbolSection.symbol(symbol.name, symbol.address);
    });
    const sections = [
      new LinkerScriptSection(this.DRAM_SECTION_NAME, dramMemory)
        .section(moduleObjFile, this.DATA_SECTIONS, true)
        .section('*', this.DATA_SECTIONS),
      new LinkerScriptSection(this.FLASH_SECTION_NAME, flashMemory)
        .section(moduleObjFile, this.EXECUTABLE_SECTIONS, true)
        .section('*', this.EXECUTABLE_SECTIONS),
      externalSymbolSection
    ];
    return new LinkerScript3()
      .input(shadowMemory.componentsInfo.getComponentsPath(moduleName))
      .memory(memories)
      .sections(sections)
      .entry(entryPointName)
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

