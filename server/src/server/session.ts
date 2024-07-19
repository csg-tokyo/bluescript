import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import FILE_PATH from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import {ShadowMemory} from "../linker/shadow-memory";


const cProlog = `
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

`

export default class Session {
  currentCodeId: number = 0;
  nameTable?: GlobalVariableNameTable;
  shadowMemory: ShadowMemory;

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

    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF);
  }

  public execute(tsString: string, useFlash:boolean=false) {
    this.currentCodeId += 1;

    // Transpile
    const tResult = transpile(this.currentCodeId, tsString, this.nameTable);
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);
    this.nameTable = tResult.names;

    // Link
    const linkResult = useFlash ? this.shadowMemory.loadToFlashAndLink(FILE_PATH.OBJ_FILE) : this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE);
    const entryPoint = this.shadowMemory.getSymbolAddress(entryPointName);
    if (entryPoint === undefined) {
      throw new Error("Cannot find entry point");
    }

    return {...linkResult, entryPoint}
  }

  public setFlashAddress(address: number) {
    this.shadowMemory.setFlashAddress(address);
  }
}