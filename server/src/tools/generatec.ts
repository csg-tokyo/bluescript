import {transpile} from "../transpiler/code-generator/code-generator";
import {JITProfilingCodeGenerator, JITSpecializingCodeGenerator} from "../jit/jit-code-generator";
import * as fs from "fs";
import {FILE_PATH} from "../constants";
import {Profiler} from "../jit/profiler";
import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import {Any, ArrayType, Integer} from "../transpiler/types";
import {runBabelParser} from "../transpiler/utils";
import {convertAst} from "../jit/ast-converter";

const cProlog = `
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"
#include "../../microcontroller/core/include/profiler.h"

`

const tsFilePath = "./temp-files/code.ts"

function transpile1(profiler: Profiler) {
  const tsString = fs.readFileSync(tsFilePath).toString();

  const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
    return new JITProfilingCodeGenerator(initializerName, codeId, moduleId, profiler, tsString);
  }

  // Transpile
  const tResult = transpile(0, tsString, undefined, undefined, -1, undefined, codeGenerator);
  const cString = cProlog + tResult.code;
  fs.writeFileSync(FILE_PATH.C_FILE, cString);
  return tResult.names;
}

function transpile2(profiler: Profiler, gvnt: GlobalVariableNameTable) {
  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    return;

  profiler.setFuncSpecializedType(0, Profiler.profiledData2Type([0x20, 0x20, 0x20, 0x21]))

  const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
    return new JITSpecializingCodeGenerator(initializerName, codeId, moduleId, profiler);
  }

  // Transpile
  const ast = runBabelParser(func.src, 1);
  if (func.specializedType === undefined)
    throw new Error()
  convertAst(ast, func.name, func.specializedType.paramTypes, func.specializedType.returnType);
  const tResult = transpile(0, func.src, gvnt, undefined, -1, ast, codeGenerator);
  tResult.names.forEach((v, k) => console.log(v, k))
  const cString = cProlog + tResult.code;
  fs.writeFileSync("./temp-files/code2.c", cString);
}

function main() {
  const profiler = new Profiler();
  const gvnt = transpile1(profiler);
  transpile2(profiler, gvnt);
}

main();