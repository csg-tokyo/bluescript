import CONSTANTS from "../constants";
import {Buffer} from "node:buffer";
import {SectionNameArr} from "../linker/models";
import * as fs from "fs";
import {execSync} from "child_process";
import SectionValueFactory from "../linker/section-value-factory";
import OnetimeEnv from "./env/onetime-env";
import {transpile} from "../transpiler/transpile";

const C_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.C_FILE_NAME;
const OBJ_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.OBJ_FILE_NAME;


export default class OnetimeCompilerChain {
  private readonly env: OnetimeEnv;

  constructor() {
    const tableDir = CONSTANTS.DEV_DB_ONCE_PATH;
    this.env = new OnetimeEnv(tableDir);
  }

  public async execWithTsString(tsString: string):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    await this.env.load();
    const cString = this.translate(tsString);
    const elfBuffer = this.compile(cString);
    return this.link(elfBuffer);
  }

  public async execWithCString(cString: string):Promise<{values:{[name: string]: string}, execFuncOffsets: number[]}> {
    await this.env.load();
    const elfBuffer = await this.compile(cString);
    return this.link(elfBuffer);
  }

  private translate(tsString: string): string {
    const existingSymbols = this.env.getSymbolTypes();
    return transpile(tsString, existingSymbols);
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

  private link(elfBuffer: Buffer):{values:{[name: string]: string}, execFuncOffsets: number[]} {
    const sectionAddresses = this.env.getSectionAddresses();
    const symbolAddresses = this.env.getSymbolAddresses();
    const factory = new SectionValueFactory(elfBuffer, symbolAddresses, sectionAddresses);
    const strategy = factory.generateStrategy();
    const sectionValues:{[name: string]: string} = {};
    SectionNameArr.forEach(sectionName => {
      const value = factory.generateSectionValue(sectionName);
      sectionValues[sectionName] = value.getLinkedValue(strategy).toString("hex");
    });
    const execFuncAddresses = factory.getSymbolAddresses(["main"]);
    console.log(execFuncAddresses)
    return {
      values: sectionValues,
      execFuncOffsets: [execFuncAddresses.main - sectionAddresses.text]
    }
  }
}