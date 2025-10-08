import { ShadowMemory } from "./compiler";


export default function generateLinkerScript(
    inputFiles: string[],
    shadowMemory: ShadowMemory, 
    definedSymbols: {name: string, address: number}[],
    entryPoint: string,
    subModuleEntryPoints: string[]
): string {
    const iramMemory = new MemoryRegion(
      "IRAM", 
      [new MemoryAttribute('executable'), new MemoryAttribute('allocatable')], 
      shadowMemory.iram.address + shadowMemory.iram.used, 
      1000000
    );
    const dramMemory = new MemoryRegion(
      "DRAM", 
      [new MemoryAttribute('read/write'), new MemoryAttribute('allocatable')], 
      shadowMemory.dram.address + shadowMemory.dram.used, 
      1000000
    );
    const iflashMemory = new MemoryRegion(
      "IFlash", 
      [new MemoryAttribute('executable')], 
      shadowMemory.iflash.address + shadowMemory.iflash.used, 
      1000000
    );
    const dflashMemory = new MemoryRegion(
      "DFlash", 
      [new MemoryAttribute('readonly')], 
      shadowMemory.dflash.address + shadowMemory.dflash.used, 
      1000000
    );
    const externalMemory = new MemoryRegion('EXTERNAL', [new MemoryAttribute('executable')], 0, 0);

    const iramSection = new Section(shadowMemory.iram.name, iramMemory)
      .section("*", ['.iram*'], false);
    const dramSection = new Section(shadowMemory.dram.name, dramMemory)
      .section("*", ['.data', '.data.*', '.bss', '.bss.*', '.dram*'], false);
    const iflashSection = new Section(shadowMemory.iflash.name, iflashMemory)
      .section("*", ['.literal', '.text', '.literal.*', '.text.*'], false);
    const dflashSection = new Section(shadowMemory.dflash.name, dflashMemory)
      .section("*", ['.rodata', '.rodata.*'], false);
    iramSection.align(4);
    iflashSection.align(4);
    
    const externalSection = new Section('.external', externalMemory);
    for (const sym of definedSymbols) {
        externalSection.symbol(sym.name, sym.address);
    }

    return new LinkerScript()
        .group(inputFiles)
        .entry(entryPoint)
        .extern(subModuleEntryPoints)
        .memory([iramMemory, dramMemory, iflashMemory, dflashMemory, externalMemory])
        .sections([iramSection, dramSection, iflashSection, dflashSection, externalSection])
        .toString();
}

class LinkerScript {
  private commands: Command[] = [];

  group(files: string[]) { this.commands.push(new Group(files)); return this; }
  extern(symbols: string[]) { this.commands.push(new Extern(symbols)); return this; }
  entry(entry: string) { this.commands.push(new Entry(entry)); return this; }
  sections(sections: Section[]) { this.commands.push(new Sections(sections)); return this; }
  memory(regions: MemoryRegion[]) { this.commands.push(new Memory(regions)); return this; }

  toString() {
    return this.commands.map(c => c.toString()).join('\n');
  }
}

interface Command {
  toString():string;
}

class Group implements Command {
  constructor(private files: string[]) {}

  toString(): string {
    return `GROUP(${this.files.join(' ')})`;
  }
}

class Extern implements Command {
  constructor(private symbols: string[]) {}

  toString(): string {
    return this.symbols.length !== 0 ? `EXTERN(${this.symbols.join(' ')})` : '';
  }
}

class Entry implements Command {
  constructor(private entry: string) {}

  toString(): string {
    return `ENTRY(${this.entry})\n`;
  }
}

class Memory implements Command {
  constructor(private regions: MemoryRegion[]) {}

  toString(): string {
    return `
MEMORY {
${this.regions.map(r => `${r.toString(1)}`).join('\n')}
}
`;
  }
}

class Sections implements Command {
  constructor(private sections: Section[]) {}

  toString(): string {
    return `
SECTIONS {
${this.sections.map(s => `${s.toString(1)}`).join('\n\n')}
}
`;
  }
}

class MemoryRegion implements Command {
  constructor(private name: string,
              private attributes: MemoryAttribute[],
              private address: number,
              private size: number) {}

  getName() { return this.name; }

  toString(indent: number = 0) {
    return `${'\t'.repeat(indent)}${this.name}   (${this.attributes.map(a => a.toString()).join('')})   : ORIGIN = 0x${this.address.toString(16)},  LENGTH = ${this.size}`;
  }
}

class MemoryAttribute {
  constructor(private attr: 'readonly' | 'read/write' | 'executable' | 'allocatable') {}

  toString() {
    switch (this.attr) {
      case "readonly":
        return 'R';
      case "read/write":
        return 'W';
      case "executable":
        return 'X';
      case 'allocatable':
        return 'A';
    }
  }
}


class Section implements Command {
  private commands: string[] = [];

  constructor(private name: string, private memory: MemoryRegion) {}

  align(align: number) {
    this.commands.push(`. = ALIGN(${Math.round(align)});`);
    return this;
  }

  symbol(name: string, address: number) {
    this.commands.push(`${name} = 0x${address.toString(16)};`);
    return this;
  }

  section(objFilePath: string, sectionNames: string[], keep: boolean = false) {
    const command = `${objFilePath}(${sectionNames.join(' ')})`;
    if (keep)
      this.commands.push(`KEEP(${command})`);
    else
      this.commands.push(command);
    return this;
  }

  toString(indent: number = 0) {
    return `\
${'\t'.repeat(indent)}${this.name} : {
${this.commands.map(comm => `${'\t'.repeat(indent + 1)}${comm}`).join('\n')}
${'\t'.repeat(indent)}} > ${this.memory.getName()}`
  }
}

