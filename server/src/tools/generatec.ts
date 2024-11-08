import * as fs from "fs";
import {FILE_PATH} from "../constants";
import {Profiler} from "../jit/profiler";
import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import {runBabelParser} from "../transpiler/utils";
import {convertAst} from "../jit/ast-converter";
import {JitCodeGenerator, jitTranspile} from "../jit/jit-code-generator";
import {NameInfo, NameTableMaker} from "../transpiler/names";
import {JitTypeChecker} from "../jit/jit-type-checker";

const cProlog = `
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"
#include "../../microcontroller/core/include/profiler.h"

`

const tsFilePath = "./temp-files/code.ts"

function transpile1(profiler: Profiler) {
  const tsString = fs.readFileSync(tsFilePath).toString();

  const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
    return new JitCodeGenerator(initializerName, codeId, moduleId, profiler, tsString);
  }

  const typeChecker = (maker: NameTableMaker<NameInfo>) => {
    return new JitTypeChecker(maker, undefined);
  }

  // Transpile
  const ast = runBabelParser(tsString, 1)
  const tResult = jitTranspile(0, ast, typeChecker, codeGenerator, undefined, undefined)
  const cString = cProlog + tResult.code;
  fs.writeFileSync(FILE_PATH.C_FILE, cString);
  return tResult.names;
}

function transpile2(profiler: Profiler, gvnt: GlobalVariableNameTable) {
  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    return;

  profiler.setFuncSpecializedType(0, Profiler.profiledData2Type([0x55, 0x55, 0x55, 0x55]))

  const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
    return new JitCodeGenerator(initializerName, codeId, moduleId, profiler, func.src);
  }

  const typeChecker = (maker: NameTableMaker<NameInfo>) => {
    return new JitTypeChecker(maker, undefined);
  }

  // Transpile
  const ast = runBabelParser(func.src, 1);
  convertAst(ast, profiler);
  const tResult = jitTranspile(0, ast, typeChecker, codeGenerator, undefined, undefined)
  tResult.names.forEach((v, k) => console.log(v, k))
  const cString = cProlog + tResult.code;
  fs.writeFileSync("./temp-files/code2.c", cString);
}

function transpile3(profiler: Profiler, gvnt: GlobalVariableNameTable) {
  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    return;

  const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
    return new JitCodeGenerator(initializerName, codeId, moduleId, profiler, func.src);
  }

  const typeChecker = (maker: NameTableMaker<NameInfo>) => {
    return new JitTypeChecker(maker, undefined);
  }

  // Transpile
  const ast = runBabelParser(func.src, 1);
  convertAst(ast, profiler);
  const tResult = jitTranspile(0, ast, typeChecker, codeGenerator, undefined, undefined)
  const cString = cProlog + tResult.code;
  fs.writeFileSync("./temp-files/code3.c", cString);
}

function main() {
  const profiler = new Profiler();
  const gvnt = transpile1(profiler);
  transpile2(profiler, gvnt);
  transpile3(profiler, gvnt);
}

main();