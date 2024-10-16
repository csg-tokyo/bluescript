import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import {FILE_PATH, MODULE_PREFIX} from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import {MemoryInfo, ShadowMemory} from "../linker/shadow-memory";


const cProlog = `
#include <stdint.h>
#include "../${FILE_PATH.C_RUNTIME_H}"

`

export default class Session {
  sessionId: number = 0;
  baseGlobalNames?: GlobalVariableNameTable
  modules: Map<string, GlobalVariableNameTable>
  shadowMemory: ShadowMemory;

  constructor(memoryInfo: MemoryInfo) {
    // Read module files.
    // fs.readdirSync(FILE_PATH.MODULES).forEach(file => {
    //   if (/.*\.ts$/.test(file)) {
    //     const tsString = fs.readFileSync(`${FILE_PATH.MODULES}/${file}`).toString()
    //     const result = transpile(++this.sessionId, tsString, this.baseGlobalNames);
    //     this.baseGlobalNames = result.names;
    //   }
    // });
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, memoryInfo);
  }

  public execute(tsString: string) {
    this.sessionId += 1;

    const start = performance.now();
    // Transpile
    // const tResult = transpile(this.sessionId, tsString, this.baseGlobalNames);
    const tResult = this.transpile(tsString);
    const cString = cProlog + tResult.code;
    this.baseGlobalNames = tResult.names;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, tResult.main);
    const end = performance.now();
    return {result: this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  private transpile(src: string) {
    const importer = (fname: string) => {
      const mod = this.modules.get(fname);
      if (mod)
        return mod;
      else {
        const ffi = fs.readFileSync(`${FILE_PATH.MODULES_FFI}/${fname}.ts`).toString();
        const moduleId = this.convertFname(fname);
        this.sessionId += 1;
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names)
        this.shadowMemory.loadAndLink(`${FILE_PATH.MODULES_O}/${fname}_${moduleId}.o`, result.main);
        return result.names
      }
    }

    this.sessionId += 1
    const result = transpile(this.sessionId, src, this.baseGlobalNames, importer);
    return result;
  }

  private convertFname(fname: string):number {
    let result = "";
    for (let i = 0; i < fname.length; i++) {
        result += fname.charCodeAt(i);
    }
    return parseInt(result) ?? 0;
}
}