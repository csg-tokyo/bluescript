import * as fs from "fs";


export class LinkerScript3 {
  private commands: LinkerScriptCommand[] = [];

  input(files: string[]) { this.commands.push(new LinkerScriptInput(files)); return this; }
  entry(entry: string) { this.commands.push(new LinkerScriptEntry(entry)); return this; }
  sections(sections: LinkerScriptSection[]) { this.commands.push(new LinkerScriptSections(sections)); return this; }
  memory(regions: LinkerScriptMemoryRegion[]) { this.commands.push(new LinkerScriptMemory(regions)); return this; }

  toString() {
    return this.commands.map(c => c.toString()).join('\n');
  }

  save(path: string) {
    fs.writeFileSync(path, this.toString());
  }
}

interface LinkerScriptCommand {
  toString():string;
}

class LinkerScriptInput implements LinkerScriptCommand {
  constructor(private files: string[]) {}

  toString(indent?: number): string {
    return `INPUT(${this.files.join(' ')})`;
  }
}

class LinkerScriptEntry implements LinkerScriptCommand {
  constructor(private entry: string) {}

  toString(): string {
    return `ENTRY(${this.entry})\n`;
  }
}

class LinkerScriptMemory implements LinkerScriptCommand {
  constructor(private regions: LinkerScriptMemoryRegion[]) {}

  toString(): string {
    return `
MEMORY {
${this.regions.map(r => `${r.toString(1)}`).join('\n')}
}
`;
  }
}

class LinkerScriptSections implements LinkerScriptCommand {
  constructor(private sections: LinkerScriptSection[]) {}

  toString(): string {
    return `
SECTIONS {
${this.sections.map(s => `${s.toString(1)}`).join('\n\n')}
}
`;
  }
}

export class LinkerScriptMemoryRegion implements LinkerScriptCommand {
  constructor(private name: string,
              private attributes: LinerScriptMemoryAttribute[],
              private address: number,
              private size: number) {}

  getName() { return this.name; }

  toString(indent: number = 0) {
    return `${'\t'.repeat(indent)}${this.name}   (${this.attributes.map(a => a.toString()).join('')})   : ORIGIN = 0x${this.address.toString(16)},  LENGTH = ${this.size}`;
  }
}

export class LinerScriptMemoryAttribute {
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


export class LinkerScriptSection implements LinkerScriptCommand {
  private commands: string[] = [];

  constructor(private name: string, private memory: LinkerScriptMemoryRegion) {}

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
${'\t'.repeat(indent + 1)}. = 0x00000000;
${this.commands.map(comm => `${'\t'.repeat(indent + 1)}${comm}`).join('\n')}
${'\t'.repeat(indent)}} > ${this.memory.getName()}`
  }
}

class LinkerScriptFormatError extends Error {
  constructor(message: string) {
    super(message);
  }
}

