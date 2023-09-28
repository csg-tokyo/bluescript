import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import {AddressTableInterface} from "../linker/address-table";
import * as fs from "fs";
import FILE_PATH from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import link, {addressTableOrigin} from "../linker";
import {execSync} from "child_process";

export default class Session {
  currentCodeId: number;
  nameTable: GlobalVariableNameTable;
  addressTable: AddressTableInterface;

  constructor() {
    this.currentCodeId = 0;
    const prolog = fs.readFileSync(FILE_PATH.NATIVE_FUNCTION_SKELETONS).toString();
    const result = transpile(this.currentCodeId, prolog);
    this.nameTable = result.names;

    const runtimeSymbols = JSON.parse(fs.readFileSync(FILE_PATH.C_RUNTIME_SYMBOLS).toString());
    const predefinedSymbolNames = runtimeSymbols.concat(Object.keys(this.nameTable.names()).map(name => "_" + name));
    this.addressTable = addressTableOrigin(predefinedSymbolNames);
  }

  public execute(tsString: string): string {
    this.currentCodeId += 1;

    // Transpile
    const tResult = transpile(this.currentCodeId, tsString, this.nameTable);
    const templateCode = fs.readFileSync(FILE_PATH.C_FILE_TEMPLATE);
    const entryPoint = tResult.main;
    const cString = templateCode + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);

    // Link
    const lResult = link(buffer, entryPoint, this.addressTable);

    // Update tables.
    this.nameTable = tResult.names;
    this.addressTable = lResult.addressTable;

    return lResult.exe;
  }
}