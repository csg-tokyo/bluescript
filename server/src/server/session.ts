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
#include "../../microcontroller/core/include/c-runtime.h"
#include "../../microcontroller/core/include/profiler.h"

`

export default class Session {
  currentCodeId: number = 0;
  nameTable?: GlobalVariableNameTable;
  shadowMemory: ShadowMemory;
  profiler: Profiler;

  constructor(memoryInfo: MemoryInfo) {
    // Read module files.
    fs.readdirSync(FILE_PATH.MODULES).forEach(file => {
      if (/.*\.ts$/.test(file)) {
        this.currentCodeId += 1;
        const tsString = fs.readFileSync(`${FILE_PATH.MODULES}/${file}`).toString()
        const result = transpile(this.currentCodeId, tsString, this.nameTable);
        this.nameTable = result.names;
      }
    });
    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, memoryInfo);
    this.profiler = new Profiler();
  }

  public execute(tsString: string) {
    this.currentCodeId += 1;

    const start = performance.now();
    // Transpile
    const tResult = transpile(this.currentCodeId, tsString, this.nameTable);
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    this.nameTable = tResult.names;

    // Link
    const lResult = this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName);
    const end = performance.now();
    return {...lResult, compileTime:end-start}
  }

  public executeWithProfiling(tsString: string) {
    this.currentCodeId += 1;

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
    const tResult = jitTranspile(this.currentCodeId, ast, typeChecker, codeGenerator, this.nameTable, undefined)
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    this.nameTable = tResult.names;

    // Link
    const lResult = this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName);
    const end = performance.now();
    return {...lResult, compileTime:end-start}
  }

  public jitExecute(profile: {funcId: number, paramTypes: string[]}) {
    console.log(profile)
    const func = this.profiler.getFunctionProfileById(profile.funcId);
    if (func === undefined)
      return {};

    this.profiler.setFuncSpecializedType(profile.funcId, profile.paramTypes.map(t => typeStringToStaticType(t, this.nameTable)))

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
    const tResult = jitTranspile(this.currentCodeId, ast, typeChecker, codeGenerator, this.nameTable, undefined)
    const entryPointName = tResult.main;
    const cString = cProlog + tResult.code;

    // Compile
    fs.writeFileSync(FILE_PATH.C_FILE, cString);
    execSync(`xtensa-esp32-elf-gcc -c -O2 ${FILE_PATH.C_FILE} -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    this.nameTable = tResult.names;

    // Link
    const lResult = this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, entryPointName);
    const end = performance.now();
    return {...lResult, compileTime:end-start}
  }

  public dummyExecute() {
    const start = performance.now();
    // Compile
    execSync(`xtensa-esp32-elf-gcc -c -O2 ./temp-files/dummy-code.c -o ${FILE_PATH.OBJ_FILE} -w -fno-common -mtext-section-literals -mlongcalls`);
    const buffer = fs.readFileSync(FILE_PATH.OBJ_FILE);

    // Link
    const lResult = this.shadowMemory.loadAndLink(FILE_PATH.OBJ_FILE, "bluescript_main6_");
    const end = performance.now();
    return {...lResult, compileTime:end-start}
  }
}