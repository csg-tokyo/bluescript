import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import {AddressTable, AddressTableInterface} from "../linker2/address-table";
import * as fs from "fs";
import CONSTANTS from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import link, {addressTableAncestor} from "../linker2";
import {execSync} from "child_process";

export default class Session {
  currentCodeId: number;
  nameTable: GlobalVariableNameTable;
  addressTable: AddressTableInterface;

  constructor() {
    this.currentCodeId = 0;
    const prolog = fs.readFileSync(CONSTANTS.NATIVE_FUNCTION_SKELETONS_PATH).toString();
    const result = transpile(this.currentCodeId, prolog);
    this.nameTable = result.names;

    const runtimeSymbols = JSON.parse(fs.readFileSync(CONSTANTS.C_RUNTIME_SYMBOLS_PATH).toString());
    const predefinedSymbolNames = runtimeSymbols.concat(Object.keys(this.nameTable.names()).map(name => "_" + name));
    this.addressTable = addressTableAncestor(predefinedSymbolNames);
  }

  public execute(tsString: string): string {
    this.currentCodeId += 1;

    // Transpile
    const tResult = transpile(this.currentCodeId, tsString, this.nameTable);
    const templateCode = fs.readFileSync(CONSTANTS.C_FILE_TEMPLATE_PATH);
    this.nameTable = tResult.names;
    const entryPoint = tResult.main;
    const cString = templateCode + tResult.code;

    // Compile
    fs.writeFileSync(CONSTANTS.C_FILE_PATH, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${CONSTANTS.C_FILE_PATH} -o ${CONSTANTS.OBJ_FILE_PATH} -w`);
    const buffer = fs.readFileSync(CONSTANTS.OBJ_FILE_PATH);

    // Link
    const lResult = link(buffer, entryPoint, this.addressTable);
    this.addressTable = lResult.addressTable;

    return lResult.exe;
  }
}