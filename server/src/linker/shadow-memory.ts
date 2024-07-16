import {ExecutableElfReader, RelocatableElfReader, Section, Symbol} from "./elf-reader";
import FILE_PATH from "../constants";
import {LinkerScript} from "./linker-script";
import {execSync} from "child_process";

const V_TEXT_SECTION_NAME = "virtual_text";
const V_DATA_SECTION_NAME = "virtual_data";

const DEFAULT_MEMORY_SIZE = 1000_000;

type MemoryUnit = {
  address: number,
  size: number,
  used: number,
  sections: Section[]
}

export class ShadowMemory {
  private iram: MemoryUnit;
  private dram: MemoryUnit;
  private symbols:Map<string, Symbol> = new Map<string, Symbol>();

  constructor(bsRuntimePath: string) {
    const bsRuntime = new ExecutableElfReader(bsRuntimePath);
    let iram:MemoryUnit|undefined = undefined;
    let dram:MemoryUnit|undefined = undefined;
    bsRuntime.readDefinedSymbols().forEach(symbol => {
      if (symbol.name === V_TEXT_SECTION_NAME) {
        iram = {
          address: symbol.address,
          size: DEFAULT_MEMORY_SIZE,
          used: 0,
          sections: []
        }
      } else if (symbol.name === V_DATA_SECTION_NAME) {
        dram = {
          address: symbol.address,
          size: DEFAULT_MEMORY_SIZE,
          used: 0,
          sections: []
        }
      } else {
        this.symbols.set(symbol.name, symbol);
      }
    });

    if (iram === undefined || dram === undefined) {
      throw new Error(`Cannot find ${V_TEXT_SECTION_NAME} or ${V_DATA_SECTION_NAME}`);
    }
    this.iram = iram;
    this.dram = dram;
  }

  public loadAndLink(objFilePath: string) {
    const relocatableElf = new RelocatableElfReader(objFilePath);
    const externalSymbols:Symbol[] = [];
    relocatableElf.readGlobalUnknownSymbolNames().forEach(name => {
      const symbol = this.symbols.get(name);
      if (symbol !== undefined)
        externalSymbols.push(symbol);
    })

    // create linker script
    const linkerScript = new LinkerScript(
      this.iram.address + this.iram.used, this.dram.address + this.dram.used);
    linkerScript.externalSymbols = externalSymbols;
    linkerScript.sectionNamesInIram = relocatableElf.readExecSectionNames();
    linkerScript.sectionNamesInDram = relocatableElf.readDataSectionNames();
    linkerScript.save(FILE_PATH.LINKER_SCRIPT);

    // link
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-ld -o ${FILE_PATH.LINKED_ELF} -T ${FILE_PATH.LINKER_SCRIPT} ${FILE_PATH.OBJ_FILE}`)

    // get linked elf32.
    const executableElf = new ExecutableElfReader(FILE_PATH.LINKED_ELF);
    const textSection = executableElf.readSection(".text");
    const dataSection = executableElf.readSection(".data");
    if (textSection === undefined || dataSection === undefined)
      throw new Error("Cannot find .text section or .data section.");
    this.iram.sections.push(textSection);
    this.dram.sections.push(dataSection);
    this.iram.used += textSection.size;
    this.dram.used += dataSection.size;
    executableElf.readDefinedSymbols().forEach(symbol => {
      this.symbols.set(symbol.name, symbol);
    })
  }

  public getLatestUpdate() {
    const lastIramSection = this.iram.sections.at(-1);
    const lastDramSection = this.dram.sections.at(-1);
    if (lastIramSection === undefined || lastDramSection === undefined)
      throw new Error("There is no update.");
    return {
      textAddress: lastIramSection.address,
      text: lastIramSection.value.toString("hex"),
      dataAddress: lastDramSection.address,
      data: lastDramSection.value.toString("hex")
    }
  }

  public getSymbolAddress(name: string) {
    return this.symbols.get(name)?.address;
  }
}


