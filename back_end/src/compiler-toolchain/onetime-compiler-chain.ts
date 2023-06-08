import CONSTANTS from "../constants";
import {Buffer} from "node:buffer";
import {SectionNameArr} from "../linker/models";
import * as fs from "fs";
import {execSync} from "child_process";
import SectionValueFactory from "../linker/section-value-factory";
import OnetimeEnv from "./env/onetime-env";
import {transpile} from "../transpiler/code-generator/code-generator";

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
    const prolog = "function console_log_number(i: integer) {}"
    const prologCcode = "#include \"../../m5stack_bluetooth/main/c-runtime.h\" \n"
    const result1 = transpile(1, prolog)
    let globalNames = result1.names
    const result2 = transpile(2, tsString, globalNames)
    globalNames = result2.names
    return prologCcode + result2.code
  }

  private compile(cString: string):Buffer {
    fs.writeFileSync(C_FILE_PATH, cString);
    // compile
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${C_FILE_PATH} -o ${OBJ_FILE_PATH} -w`);
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
    const execFuncAddresses = factory.getSymbolAddresses(["bluescript_main2"]);
    console.log(execFuncAddresses)
    return {
      values: sectionValues,
      execFuncOffsets: [execFuncAddresses.bluescript_main2 - sectionAddresses.text]
    }
  }
}
