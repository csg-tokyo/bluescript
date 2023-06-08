import {GlobalNameTable} from "../transpiler/type-checker/names";
import {VariableInfo} from "../transpiler/code-generator/variables";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import * as fs from "fs";
import CONSTANTS from "../constants";
import {Buffer} from "node:buffer";
import AddressTable from "../linker2/addresses";
import {link} from "../linker2";


const C_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.C_FILE_NAME;
const OBJ_FILE_PATH = CONSTANTS.CODE_FILES_DIR_PATH + CONSTANTS.OBJ_FILE_NAME;

const prolog = `
function print(m: any) {}
`

const prologCcode = "#include \"../../m5stack_bluetooth/main/c-runtime.h\" \n"

export class Stream {
  sessionId: number
  nameTable: GlobalNameTable<VariableInfo>
  addressTable: AddressTable

  constructor() {
    this.sessionId = 1
    const result = transpile(this.sessionId, prolog)
    this.nameTable = result.names
    this.addressTable = new AddressTable(Object.keys(this.nameTable.names()))
    this.sessionId += 1
  }

  public execute(tsString: string): string {
    const cString = this.transpile(tsString)
    const buffer = this.compile(cString)
    return this.link(buffer)
  }

  private transpile(tsString: string): string {
    const result2 = transpile(this.sessionId, tsString, this.nameTable)
    this.nameTable = result2.names
    this.sessionId += 1
    return prologCcode + result2.code
  }

  private compile(cString: string): Buffer {
    fs.writeFileSync(C_FILE_PATH, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${C_FILE_PATH} -o ${OBJ_FILE_PATH} -w`);
    return fs.readFileSync(OBJ_FILE_PATH);
  }

  private link(buffer: Buffer): string {
    const newSymbolNames = Object.keys(this.nameTable.names())
    const result = link(this.sessionId, buffer, newSymbolNames, this.addressTable)
    this.addressTable = result.addressTable
    return result.exe
  }
}