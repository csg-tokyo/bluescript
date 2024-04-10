import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import FILE_PATH from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import {link, AddressTable} from "../linker";


const cProlog = `
#include <stdint.h>
#include "../../esp32/components/c-runtime/c-runtime.h"

`

export default class Session {
  currentCodeId: number;
  nameTable: GlobalVariableNameTable;
  addressTable?: AddressTable;

  constructor() {
    this.currentCodeId = 0;
    const libSrc = fs.readFileSync(FILE_PATH.HARDWARE_LIB).toString();
    const libResult = transpile(this.currentCodeId, libSrc);
    // const src0 = fs.readFileSync(FILE_PATH.USER_PROGRAM).toString();
    // const src0Result = transpile(this.currentCodeId, src0, libResult.names);
    this.nameTable = libResult.names;
  }

  public execute(tsString: string): string {
    this.currentCodeId += 1;

    // Transpile
    const tResult = transpile(this.currentCodeId, tsString, this.nameTable);
    const entryPoint = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);

    // Link
    const lResult = link(buffer, entryPoint, this.addressTable);

    // Update tables.
    this.nameTable = tResult.names;
    this.addressTable = lResult.addressTable;

    return lResult.exe;
  }
}