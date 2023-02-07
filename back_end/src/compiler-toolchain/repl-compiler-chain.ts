import CONSTANTS from "../constants";
import CompilerToolChainEnv from "./env/compiler-tool-chain-env";
import {Buffer} from "node:buffer";
import {SectionNameArr} from "../models/section-model";
import * as fs from "fs";
import {execSync} from "child_process";
import SectionValueFactory from "./linker/section-value-factory";
import ReplTranslator from "../utils/translator/repl-translator";

export default class ReplCompilerChain {
  private C_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.C_FILE_NAME;
  private OBJ_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.OBJ_FILE_NAME;

  private readonly env: CompilerToolChainEnv;

  constructor() {
    const tableDir = CONSTANTS.DEV_DB_ONCE_PATH;
    this.env = new CompilerToolChainEnv(tableDir);
  }

  public async clearEnv() {
    await this.env.initialize();
  }

  public async exec(tsString: string, isFirst: boolean = false):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    if (isFirst) {
      await this.env.initialize();
    }
    const {cString,newDefinedSymbolNames, execFuncNames} = await this.translate(tsString);
    const elfBuffer = await this.compile(cString);
    const {values, execFuncOffsets} =  await this.link(elfBuffer, newDefinedSymbolNames, execFuncNames);
    await this.env.storeNewDataToDB();
    return {values, execFuncOffsets};
  }

  private async translate(tsString: string): Promise<{cString: string, newDefinedSymbolNames:string[], execFuncNames: string[]}> {
    const publicSymbols = await this.env.generatePublicSymbolTypes();
    const translator = new ReplTranslator(tsString, publicSymbols);
    const {cString, newDefinedSymbols, execFuncNames} = translator.translate();
    await this.env.setNewDefinedSymbols(newDefinedSymbols);
    return {cString,newDefinedSymbolNames: newDefinedSymbols.map(s => s.name), execFuncNames};
  }

  private async compile(cString: string):Promise<Buffer> {
    // write c file
    let cFileString = fs.readFileSync(CONSTANTS.C_FILE_TEMPLATE_PATH).toString();
    const symbols = await this.env.generateSymbolDeclarations();
    symbols.forEach(symbol => {
      if (symbol.symbolType === "variable") {
        cFileString += `extern ${symbol.declaration}\n`;
      } else {
        cFileString += `${symbol.declaration}\n`
      }
    });
    cFileString += cString;
    fs.writeFileSync(this.C_FILE_PATH, cFileString);
    // compile
    execSync(`xtensa-esp32-elf-gcc -c -O1 ${this.C_FILE_PATH} -o ${this.OBJ_FILE_PATH} -w`);
    return fs.readFileSync(this.OBJ_FILE_PATH);
  }

  private async link(elfBuffer: Buffer,newDefinedSymbolNames: string[], execFuncNames:string[]):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    // Prepare data.
    const sectionAddresses = await this.env.generateSectionStartAddresses();
    const symbolAddresses = await this.env.generateSymbolAddresses();
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
    const execFuncAddresses = factory.getDefinedSymbolAddresses(execFuncNames);
    const newDefinedSymbolAddresses = factory.getDefinedSymbolAddresses(newDefinedSymbolNames);
    // Set to env.
    this.env.setNewDefinedSymbolAddresses(newDefinedSymbolAddresses);
    this.env.setSectionUsedMemorySizes(useMemorySizes);
    // get execFuncOffsets
    const execFuncOffsets:number[] = [];
    const textSectionAddress = await this.env.generateTextSectionAddress();
    execFuncNames.forEach(name => {
      execFuncOffsets.push(execFuncAddresses[name] - textSectionAddress);
    })

    return {values: sectionValues, execFuncOffsets};
  }
}