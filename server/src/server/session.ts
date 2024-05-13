import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import FILE_PATH from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import {link, AddressTable} from "../linker";


const cProlog = `
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

`

export default class Session {
  currentCodeId: number = 0;
  nameTable?: GlobalVariableNameTable;
  addressTable?: AddressTable;

  constructor() {
    // Read module files.
    fs.readdirSync(FILE_PATH.MODULES).forEach(file => {
      if (/.*\.ts$/.test(file)) {
        this.currentCodeId += 1;
        const tsString = fs.readFileSync(`${FILE_PATH.MODULES}/${file}`).toString()
        const result = transpile(this.currentCodeId, tsString, this.nameTable);
        this.nameTable = result.names;
      }
    });
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