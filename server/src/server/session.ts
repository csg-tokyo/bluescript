import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import {FILE_PATH} from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import {Profiler} from "../jit/profiler";
import {runBabelParser} from "../transpiler/utils";
import {convertAst, typeStringToStaticType} from "../jit/utils";
import {JitCodeGenerator, jitTranspile} from "../jit/jit-code-generator";
import {NameInfo, NameTableMaker} from "../transpiler/names";
import {JitTypeChecker} from "../jit/jit-type-checker";
import {MemoryAddresses, ShadowMemory} from "../linker/shadow-memory";


const cProlog = `
#include <stdint.h>
#include "../${FILE_PATH.C_RUNTIME_H}"
#include "../${FILE_PATH.PROFILER_H}"
`


export default class Session {
  sessionId: number = 0;
  baseGlobalNames?: GlobalVariableNameTable
  modules: Map<string, GlobalVariableNameTable>
  shadowMemory: ShadowMemory;
  profiler: Profiler;

  constructor(addresses: MemoryAddresses) {
    const bsString = fs.readFileSync(`${FILE_PATH.STD_MODULES}`).toString()
    const result = transpile(++this.sessionId, bsString, this.baseGlobalNames);
    this.baseGlobalNames = result.names;
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, addresses)
    this.profiler = new Profiler();
  }

  public execute(src: string, useFlash = false) {
    const start = performance.now();
    this.sessionId += 1;

    // Transpile
    const tResult = this.transpile(src);
    this.baseGlobalNames = tResult.names;

    // Compile
    const cString = cProlog + tResult.code;
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, tResult.main, useFlash);
    const end = performance.now();
    return  {result: this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  public executeWithProfiling(src: string) {
    const start = performance.now();
    this.sessionId += 1;

    // Transpile
    const tResult = this.transpileForJIT(src)
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    this.baseGlobalNames = tResult.names;

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName, false);
    const end = performance.now();
    return {result: this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  public jitExecute(funcId: number, paramTypes: string[]) {
    const start = performance.now();
    this.sessionId += 1

    const func = this.profiler.getFunctionProfileById(funcId);
    if (func === undefined)
      return {}; // TODO： 要修正
    this.profiler.setFuncSpecializedType(funcId, paramTypes.map(t => typeStringToStaticType(t, this.baseGlobalNames)))

    // Transpile
    const tResult = this.transpileForJIT(func.src)
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    this.baseGlobalNames = tResult.names;

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName, false);
    const end = performance.now();
    return {result: this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  private transpile(src: string) {
    const importer = (fname: string) => {
      const mod = this.modules.get(fname);
      if (mod)
        return mod;
      else {
        const ffi = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}/${fname}.bs`).toString();
        const moduleId = Session.moduleNameToId(fname);
        this.sessionId += 1;
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names)
        this.shadowMemory.loadAndLinkModule(fname, result.main)
        return result.names
      }
    }

    return transpile(this.sessionId, src, this.baseGlobalNames, importer);
  }

  private transpileForJIT(src: string) {
    const importer = (fname: string) => {
      const mod = this.modules.get(fname);
      if (mod)
        return mod;
      else {
        const ffi = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}/${fname}.bs`).toString();
        const moduleId = Session.moduleNameToId(fname);
        this.sessionId += 1;
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names)
        this.shadowMemory.loadAndLinkModule(fname, result.main)
        return result.names
      }
    }

    const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
      return new JitCodeGenerator(initializerName, codeId, moduleId, this.profiler, src);
    }

    const typeChecker = (maker: NameTableMaker<NameInfo>) => {
      return new JitTypeChecker(maker, importer);
    }

    const ast = runBabelParser(src, 1);
    convertAst(ast, this.profiler);
    return  jitTranspile(this.sessionId, ast, typeChecker, codeGenerator, this.baseGlobalNames)
  }

  public dummyExecute() {
    const start = performance.now();
    // Compile
    execSync(`xtensa-esp32-elf-gcc -c -O2 ./temp-files/dummy-code.c -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, "bluescript_main6_", false);
    const end = performance.now();
    return {result: this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  static moduleNameToId(fname: string):number {
    let result = "";
    for (let i = 0; i < fname.length; i++) {
      result += fname.charCodeAt(i);
    }
    return parseInt(result, 10) ?? 0;
  }
}