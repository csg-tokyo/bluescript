import {MemoryBlock, ShadowMemory} from "./shadow-memory";
import {ElfReader, SECTION_TYPE, Symbol} from "./elf-reader";
import * as fs from "fs";
import {execSync} from "child_process";
import {
  LinerScriptMemoryAttribute,
  LinkerScript,
  LinkerScriptMemoryRegion,
  LinkerScriptSection
} from "./linker-script";


const EXTERNAL_SYMBOL_SECTION = '.external_symbols'


export class Compiler {
  protected readonly C_FILE = './temp-files/code.c';
  protected readonly OBJ_FILE = './temp-files/code.o';
  protected readonly LINKER_SCRIPT = './temp-files/linkerscript.ld';
  protected readonly LINKED_ELF = './temp-files/code';
  protected readonly DATA_SECTIONS = ['.data', '.data.*', '.rodata', '.rodata.*', '.bss', '.bss.*', '.dram*'];
  protected readonly EXECUTABLE_SECTIONS = ['.literal', '.text', '.literal.*', '.text.*', '.iram*'];
  protected readonly IRAM_SECTION_NAME = '.iram';
  protected readonly DRAM_SECTION_NAME = '.dram';
  protected readonly FLASH_SECTION_NAME = '.flash';

  constructor(protected compilerPath = '') {}

  compile(shadowMemory: ShadowMemory, compileId: number, src: string, entryPointName: string) {
    const objFile = this._compile(src);
    const linkedElf = this.link(shadowMemory, objFile, entryPointName);
    this.load(shadowMemory, compileId, linkedElf, entryPointName)
  }

  protected _compile(src: string) {
    fs.writeFileSync(this.C_FILE, src);
    execSync(`${this.compilerPath}xtensa-esp32-elf-gcc -c -O2 ${this.C_FILE} -o ${this.OBJ_FILE} -w -fno-common -ffunction-sections -mtext-section-literals -mlongcalls -fno-zero-initialized-in-bss`);
    return new ElfReader(this.OBJ_FILE);
  }

  protected link(shadowMemory: ShadowMemory, objFile: ElfReader, entryPointName: string) {
    const externalSymbols = this.readExternalSymbols(shadowMemory, objFile);
    const linkerScript = this.generateLinkerScript(shadowMemory, externalSymbols, objFile, entryPointName);
    const linkedElf = this._link(linkerScript);
    this.allocateDram(shadowMemory, linkedElf);
    this.allocateFlash(shadowMemory, linkedElf);
    return linkedElf;
  }

  protected readExternalSymbols(shadowMemory: ShadowMemory, objFile: ElfReader) {
    const externalSymbols: Symbol[] = [];
    objFile.readExternalSymbols().forEach(symbol => {
      const definedSymbol = shadowMemory.symbols.get(symbol.name);
      if (definedSymbol !== undefined)
        externalSymbols.push(definedSymbol);
    });
    return externalSymbols;
  }

  protected generateLinkerScript(shadowMemory: ShadowMemory, externalSymbols: Symbol[], objFile: ElfReader, entryPointName: string):LinkerScript {
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
    externalSymbols.forEach(symbol => {
      externalSymbolSection.symbol(symbol.name, symbol.address);
    });
    const sections = [
      new LinkerScriptSection(this.DRAM_SECTION_NAME, dramMemory)
        .section(objFile.filePath, this.DATA_SECTIONS),
      new LinkerScriptSection(this.FLASH_SECTION_NAME, flashMemory)
        .section(objFile.filePath, this.EXECUTABLE_SECTIONS),
      externalSymbolSection
    ];
    return new LinkerScript()
      .input([objFile.filePath])
      .memory(memories)
      .sections(sections)
      .entry(entryPointName)
  }

  protected _link(linkerScript: LinkerScript) {
    linkerScript.save(this.LINKER_SCRIPT)
    execSync(`${this.compilerPath}xtensa-esp32-elf-ld -o ${this.LINKED_ELF} -T ${this.LINKER_SCRIPT}`);
    return new ElfReader(this.LINKED_ELF);
  }

  protected allocateDram(shadowMemory: ShadowMemory, elf: ElfReader) {
    const dramSection = elf.readSectionByName(this.DRAM_SECTION_NAME);
    if (dramSection !== undefined)
      shadowMemory.dram.allocate(dramSection);
  }

  protected allocateFlash(shadowMemory: ShadowMemory, elf: ElfReader) {
    const flashSection = elf.readSectionByName(this.FLASH_SECTION_NAME);
    if (flashSection !== undefined)
      shadowMemory.flash.allocate(flashSection);
  }

  protected load(shadowMemory: ShadowMemory, compileId:number, linkedElf: ElfReader, entryPointName: string) {
    const dramSection = linkedElf.readSectionByName(this.DRAM_SECTION_NAME);
    const flashSection = linkedElf.readSectionByName(this.FLASH_SECTION_NAME);
    linkedElf.readDefinedSymbols().forEach(symbol => {
      shadowMemory.symbols.set(symbol.name, symbol);
    });
    const entryPoint = shadowMemory.symbols.get(entryPointName)?.address;
    if (entryPoint === undefined)
      throw new Error(`Cannot find entry point: ${entryPointName}`);
    shadowMemory.loadToDram(dramSection !== undefined ? [dramSection]: []);
    shadowMemory.loadToIFlash(flashSection !== undefined ? [flashSection]: []);
    shadowMemory.loadEntryPoint(compileId, entryPoint);
  }
}


export class InteractiveCompiler extends Compiler {

  constructor(protected compilerPath = '') {
    super(compilerPath);
  }

  compile(shadowMemory: ShadowMemory, compileId: number, src: string, entryPointName: string) {
    const objFile = this._compile(src);
    const linkedElf = this.interactiveLink(shadowMemory, compileId, objFile, entryPointName);
    this.load(shadowMemory, compileId, linkedElf, entryPointName)
  }

  protected interactiveLink(shadowMemory: ShadowMemory, compileId: number, objFile: ElfReader, entryPointName: string) {
    this.registerFreeableFuncSections(shadowMemory, compileId, objFile);
    const iramMemoryBlocks = this.allocateIram(shadowMemory, objFile);
    this.registerFreeableEntryPoint(shadowMemory, compileId, entryPointName);
    const externalSymbols = this.readExternalSymbols(shadowMemory, objFile);
    const linkerScript = this.generateInteractiveLinkerScript(shadowMemory, iramMemoryBlocks, externalSymbols, objFile, entryPointName);
    const linkedElf = this._link(linkerScript);
    this.allocateDram(shadowMemory, linkedElf);
    return linkedElf;
  }

  protected load(shadowMemory: ShadowMemory, compileId:number, linkedElf: ElfReader, entryPointName: string) {
    const iramSections = linkedElf
      .readSectionsStartWith(this.IRAM_SECTION_NAME)
      .filter(section => section.size !== 0);
    linkedElf.readDefinedSymbols().forEach(symbol => {
      shadowMemory.symbols.set(symbol.name, symbol);
    });
    shadowMemory.loadToIram(iramSections);
    const dramSection = linkedElf.readSectionByName(this.DRAM_SECTION_NAME);
    shadowMemory.loadToDram(dramSection !== undefined ? [dramSection]: []);
    const entryPoint = shadowMemory.symbols.get(entryPointName)?.address;
    if (entryPoint === undefined)
      throw new Error(`Cannot find entry point: ${entryPointName}`);
    shadowMemory.loadEntryPoint(compileId, entryPoint);
  }

  private registerFreeableFuncSections(shadowMemory: ShadowMemory, compileId: number, objFile: ElfReader) {
    const funcSymbols = objFile.readFunctions();
    funcSymbols.forEach(symbol => {
      if (shadowMemory.symbols.has(symbol.name))
        shadowMemory.setFreeableIramSection(compileId, this.funcNameToSectionName(symbol.name))
    });
  }

  private registerFreeableEntryPoint(shadowMemory: ShadowMemory, compileId: number, entryPoint: string) {
    shadowMemory.setFreeableIramSection(compileId, this.funcNameToSectionName(entryPoint));
  }

  private generateInteractiveLinkerScript(
    shadowMemory: ShadowMemory, iramBlocks: MemoryBlock[],
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
      const section = new LinkerScriptSection(`${this.IRAM_SECTION_NAME}${index}`, memoryRegion)
        .section(objFile.filePath, [block.sectionName ?? ''])
        .align(4);
      memories.push(memoryRegion);
      sections.push(section);
    });
    const dramMemory = new LinkerScriptMemoryRegion(
      'DRAM',
      [new LinerScriptMemoryAttribute('read/write'), new LinerScriptMemoryAttribute('readonly')],
      shadowMemory.dram.getNextAddress(),
      1000000);
    memories.push(dramMemory);
    sections.push(new LinkerScriptSection(this.DRAM_SECTION_NAME, dramMemory)
      .section(objFile.filePath, this.DATA_SECTIONS))

    return new LinkerScript()
      .input([objFile.filePath])
      .entry(entryPointName)
      .memory(memories)
      .sections(sections)
  }

  private allocateIram(shadowMemory: ShadowMemory, objFile: ElfReader) {
    const executableSections = objFile.readSections(SECTION_TYPE.EXECUTABLE).filter(section => section.size !== 0);
    return executableSections.map(section => shadowMemory.iram.allocate(section));
  }

  private funcNameToSectionName(funcName: string) {
    return `.text.${funcName}`;
  }
}

export class ModuleCompiler extends Compiler {
  protected readonly MODULE_LINKER_SCRIPT = './temp-files/module-linkerscript.ld';
  private readonly MODULE_LINKED_ELF = './temp-files/module-code';


  constructor(protected compilerPath: string = '') {
    super(compilerPath)
  }

  override compile(shadowMemory: ShadowMemory, compileId: number, moduleName: string, entryPointName: string) {
    const executableElf = this.moduleLink(shadowMemory, moduleName, entryPointName);
    this.load(shadowMemory, compileId, executableElf, entryPointName)
  }

  private moduleLink(shadowMemory: ShadowMemory, moduleName: string, entryPointName: string): ElfReader {
    const linkerScript = this.generateModuleLinkerScript(shadowMemory, moduleName, entryPointName);
    const linkedElf = this._link(linkerScript);
    this.allocateDram(shadowMemory, linkedElf);
    this.allocateFlash(shadowMemory, linkedElf);
    return linkedElf;
  }

  override _link(linkerScript: LinkerScript) {
    linkerScript.save(this.MODULE_LINKER_SCRIPT);
    execSync(`${this.compilerPath}xtensa-esp32-elf-ld -o ${this.MODULE_LINKED_ELF} -T ${this.MODULE_LINKER_SCRIPT} --gc-sections`);
    return new ElfReader(this.MODULE_LINKED_ELF);
  }

  private generateModuleLinkerScript(shadowMemory: ShadowMemory, moduleName: string, entryPointName: string) {
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
    return new LinkerScript()
      .input(shadowMemory.componentsInfo.getComponentsPath(moduleName))
      .memory(memories)
      .sections(sections)
      .entry(entryPointName)
  }
}
