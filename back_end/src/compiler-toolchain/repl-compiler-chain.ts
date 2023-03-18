import CONSTANTS from "../constants";
import {Buffer} from "node:buffer";
import {SectionNameArr} from "../linker/models";
import * as fs from "fs";
import {execSync} from "child_process";
import SectionValueFactory from "../linker/section-value-factory";
import ReplEnv from "./env/repl-env";
import {replTranspile} from "../transpiler/repl-transpile";


const C_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.C_FILE_NAME;
const OBJ_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.OBJ_FILE_NAME;

export default class ReplCompilerChain {
  private readonly env: ReplEnv;

  constructor() {
    const tableDir = CONSTANTS.DEV_DB_REPL_PATH;
    this.env = new ReplEnv(tableDir);
  }

  public async clearEnv() {
    await this.env.initTable();
  }

  public async exec(tsString: string, isFirst: boolean = false):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    await this.env.load(isFirst)
    const cString = this.translate(tsString);
    const elfBuffer = this.compile(cString);
    const {values, execFuncOffsets} =  await this.link(elfBuffer);
    await this.env.store();
    return {values, execFuncOffsets};
  }

  private translate(tsString: string): string {
    const existingSymbols = this.env.getSymbolTypes();
    const {cString, newSymbols, execFuncNames} = replTranspile(tsString, existingSymbols);
    this.env.setNewSymbols(newSymbols);
    this.env.setExecFuncNames(execFuncNames)
    return cString;
  }

  private compile(cString: string):Buffer {
    // write c file
    let cFileString = fs.readFileSync(CONSTANTS.C_FILE_TEMPLATE_PATH).toString();
    const symbols = this.env.getSymbolDeclarations();
    symbols.forEach(declaration => {
      cFileString += `${declaration}\n`
    });
    cFileString += cString;
    fs.writeFileSync(C_FILE_PATH, cFileString);
    // compile
    execSync(`xtensa-esp32-elf-gcc -c -O0 ${C_FILE_PATH} -o ${OBJ_FILE_PATH} -w`);
    return fs.readFileSync(OBJ_FILE_PATH);
  }

  private async link(elfBuffer: Buffer):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    // Prepare data.
    const sectionAddresses = this.env.getSectionAddresses();
    const symbolAddresses = this.env.getSymbolAddresses();
    // Link.
    const factory = new SectionValueFactory(elfBuffer, symbolAddresses, sectionAddresses);
    const strategy = factory.generateStrategy();
    const sectionValues:{[name: string]: string} = {};
    const useMemorySizes: {[name: string]: number} = {};
    SectionNameArr.forEach(sectionName => {
      const value = factory.generateSectionValue(sectionName);
      sectionValues[sectionName] = value.getLinkedValue(strategy).toString("hex");
      useMemorySizes[sectionName] = value.getSize();
    });
    const execFuncAddresses = factory.getSymbolAddresses(this.env.execFuncNames);
    const newSymbolAddresses = factory.getSymbolAddresses(Object.keys(this.env.newSymbols));
    // Set to env.
    this.env.setSymbolAddresses(newSymbolAddresses);
    this.env.setUsedMemorySize(useMemorySizes);
    // get execFuncOffsets
    const execFuncOffsets:number[] = [];
    const textSectionAddress = this.env.getTextSectionBaseAddress();
    this.env.execFuncNames.forEach(name => {
      execFuncOffsets.push(execFuncAddresses[name] - textSectionAddress);
    })

    return {values: sectionValues, execFuncOffsets};
  }
}