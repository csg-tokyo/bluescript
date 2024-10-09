import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import {FILE_PATH} from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import {MemoryInfo, ShadowMemory} from "../linker/shadow-memory";


const cProlog = `
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

`

export default class Session {
  sessionId: number = 0;
  moduleId: number = 0;
  baseGlobalNames?: GlobalVariableNameTable
  modules: Map<string, GlobalVariableNameTable>
  shadowMemory: ShadowMemory;

  constructor(memoryInfo: MemoryInfo) {
    // Read module files.
    fs.readdirSync(FILE_PATH.MODULES).forEach(file => {
      if (/.*\.ts$/.test(file)) {
        const tsString = fs.readFileSync(`${FILE_PATH.MODULES}/${file}`).toString()
        const result = transpile(++this.sessionId, tsString, this.baseGlobalNames);
        this.baseGlobalNames = result.names;
      }
    });
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, memoryInfo);
  }

  public execute(tsString: string) {
    this.sessionId += 1;

    const start = performance.now();
    // Transpile
    const tResult = transpile(this.sessionId, tsString, this.baseGlobalNames);
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;
    this.baseGlobalNames = tResult.names;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);

    // Link
    const lResult = this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName);
    const end = performance.now();
    return {...lResult, compileTime:end-start}
  }

  private compile(src: string) {
    fs.writeFileSync(FILE_PATH.C_FILE, src);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);
  }

  private transpile(src: string) {
    const importer = (fname: string) => {
      const mod = this.modules.get(fname)
      if (mod)
        return mod
      else {
        const program = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}`).toString()
        this.moduleId += 1
        this.sessionId += 1
        const result = transpile(this.sessionId, program, this.baseGlobalNames, importer, this.moduleId)
        this.modules.set(fname, result.names)
        return result.names
      }
    }

    this.sessionId += 1
    const result = transpile(this.sessionId, src, this.baseGlobalNames, importer)
    return result.names
  }
}