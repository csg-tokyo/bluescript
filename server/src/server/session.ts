import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import {FILE_PATH} from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {execSync} from "child_process";
import {MemoryInfo, ShadowMemory} from "../linker/shadow-memory";
import {Profiler} from "../jit/profiler";
import {runBabelParser} from "../transpiler/utils";
import {convertAst, typeStringToStaticType} from "../jit/utils";
import {JitCodeGenerator, jitTranspile} from "../jit/jit-code-generator";
import {NameInfo, NameTableMaker} from "../transpiler/names";
import {JitTypeChecker} from "../jit/jit-type-checker";


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

  constructor(memoryInfo: MemoryInfo) {
    const bsString = fs.readFileSync(`${FILE_PATH.STD_MODULES}`).toString()
    const result = transpile(++this.sessionId, bsString, this.baseGlobalNames);
    this.baseGlobalNames = result.names;
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, memoryInfo);
    this.profiler = new Profiler();
  }

  public execute(bsString: string) {
    this.sessionId += 1;

    const start = performance.now();
    // Transpile
    const tResult = this.transpile(bsString);
    const cString = cProlog + tResult.code;
    this.baseGlobalNames = tResult.names;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, tResult.main);
    const end = performance.now();
    const response =   {result: this.shadowMemory.getUpdates(), compileTime:end-start}
    console.log(response)
    return response
  }

  private transpile(src: string) {
    const importer = (fname: string) => {
      const mod = this.modules.get(fname);
      if (mod)
        return mod;
      else {
        const ffi = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}_${this.convertFname(fname)}/${fname}.bs`).toString();
        const moduleId = this.convertFname(fname);
        this.sessionId += 1;
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names)
        // this.shadowMemory.loadAndLink(`${FILE_PATH.MODULES_O}/${fname}_${moduleId}.o`, result.main);
        this.shadowMemory.loadAndLinkForImport(result.main)
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
    return parseInt(result, 10) ?? 0;
  }

  public executeWithProfiling(tsString: string) {
    this.sessionId += 1;

    const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
      return new JitCodeGenerator(initializerName, codeId, moduleId, this.profiler, tsString);
    }

    const typeChecker = (maker: NameTableMaker<NameInfo>) => {
      return new JitTypeChecker(maker, undefined);
    }

    const start = performance.now();

    // Transpile
    const ast = runBabelParser(tsString, 1);
    convertAst(ast, this.profiler);
    const tResult = jitTranspile(this.sessionId, ast, typeChecker, codeGenerator, this.baseGlobalNames, undefined)
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    this.baseGlobalNames = tResult.names;

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName);
    const end = performance.now();
    return {...this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  public jitExecute(profile: {funcId: number, paramTypes: string[]}) {
    console.log(profile)
    const func = this.profiler.getFunctionProfileById(profile.funcId);
    if (func === undefined)
      return {};

    this.profiler.setFuncSpecializedType(profile.funcId, profile.paramTypes.map(t => typeStringToStaticType(t, this.baseGlobalNames)))

    const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
      return new JitCodeGenerator(initializerName, codeId, moduleId, this.profiler, func.src);
    }

    const typeChecker = (maker: NameTableMaker<NameInfo>) => {
      return new JitTypeChecker(maker, undefined);
    }

    // Transpile
    const start = performance.now();
    const ast = runBabelParser(func.src, 1);
    convertAst(ast, this.profiler);
    const tResult = jitTranspile(this.sessionId, ast, typeChecker, codeGenerator, this.baseGlobalNames, undefined)
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    this.baseGlobalNames = tResult.names;

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName);
    const end = performance.now();
    return {...this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  public dummyExecute() {
    const start = performance.now();
    // Compile
    execSync(`xtensa-esp32-elf-gcc -c -O2 ./temp-files/dummy-code.c -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);

    // Link
    this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, "bluescript_main6_");
    const end = performance.now();
    return {...this.shadowMemory.getUpdates(), compileTime:end-start}
  }
}