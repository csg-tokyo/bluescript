import CONSTANTS from "../constants";
import CompilerToolChainEnv from "./env/compiler-tool-chain-env";
import BlockEnv from "../utils/translator/env";
import translate from "../utils/translator/translate";
import {Buffer} from "node:buffer";
import {SectionNameArr} from "../models/section-model";
import * as fs from "fs";
import {execSync} from "child_process";
import SectionValueFactory from "../linker/section-value-factory";

export default class OnetimeCompilerChain {
  private C_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.C_FILE_NAME;
  private OBJ_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.OBJ_FILE_NAME;

  private readonly env: CompilerToolChainEnv;

  constructor() {
    const tableDir = CONSTANTS.DEV_DB_ONCE_PATH;
    this.env = new CompilerToolChainEnv(tableDir);
  }

  public async execWithTsString(tsString: string):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    await this.env.initialize();
    const cString = await this.translate(tsString);
    const elfBuffer = await this.compile(cString);
    return this.link(elfBuffer);
  }

  public async execWithCString(cString: string):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    await this.env.initialize();
    const elfBuffer = await this.compile(cString);
    return this.link(elfBuffer);
  }

  private async translate(tsString: string): Promise<string> {
    const publicSymbols = await this.env.generatePublicSymbolTypes();
    const blockEnv = new BlockEnv(undefined, publicSymbols);
    return translate(tsString, blockEnv);
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

  private async link(elfBuffer: Buffer):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    const sectionAddresses = await this.env.generateSectionStartAddresses();
    const symbolAddresses = await this.env.generateSymbolAddresses();
    const factory = new SectionValueFactory(elfBuffer, symbolAddresses, sectionAddresses);
    const strategy = factory.generateStrategy();
    const sectionValues:{[name: string]: string} = {};
    SectionNameArr.forEach(sectionName => {
      const value = factory.generateSectionValue(sectionName);
      sectionValues[sectionName] = value.getLinkedValue(strategy).toString("hex");
    });
    const execFuncAddresses = factory.getDefinedSymbolAddresses(["main"]);
    return {
      values: sectionValues,
      execFuncOffsets: [execFuncAddresses.main - sectionAddresses.text]
    }
  }
}