import {transpile} from "../../src/transpiler/code-generator/code-generator";
import * as fs from "fs";
import {execSync} from "child_process";
import {JitCodeGenerator, jitTranspile} from "../../src/jit/jit-code-generator";
import {NameInfo, NameTableMaker} from "../../src/transpiler/names";
import {JitTypeChecker} from "../../src/jit/jit-type-checker";
import {Profiler} from "../../src/jit/profiler";
import {runBabelParser} from "../../src/transpiler/utils";
import {GlobalVariableNameTable} from "../../src/transpiler/code-generator/variables";
import {convertAst} from "../../src/jit/utils";


const prolog = `// predefined native functions
function print(m: any) {}
function print_i32(m: integer) {}
function performance_now(): integer { return 0 }
`


const prologCcode = `/* To compile, cc -DTEST64 this_file.c c-runtime.c */
#include "../../microcontroller/core/include/c-runtime.h"
#include "../../microcontroller/core/include/profiler.h"

`
const prologCcode2 = `
#include <stdio.h>
#include <time.h>

static void fbody_print(value_t self, value_t m) {
  if (is_int_value(m))
    printf("%d\\n", value_to_int(m));
  else if (is_float_value(m))
    printf("%f\\n", value_to_float(m));
  else if (m == VALUE_NULL || m == VALUE_UNDEF)
    puts("undefined");
  else if (gc_is_string_object(m))
    puts(gc_string_literal_cstr(m));
  else {
    class_object* cls = gc_get_class_of(m);
    if (cls == NULL)
      puts("??");
    else
      printf("<class %s>\\n", cls->name);
  }
}

static void fbody_print_i32(value_t self, int32_t i) {
  printf("%d\\n", i);
}

/* msec */
static int32_t fbody_performance_now(value_t self) {
  static struct timespec ts0 = { 0, -1 };
  struct timespec ts;
  if (ts0.tv_nsec < 0)
    clock_gettime(CLOCK_REALTIME, &ts0);

  clock_gettime(CLOCK_REALTIME, &ts);
  return (int32_t)((ts.tv_sec - ts0.tv_sec) * 1000 + (ts.tv_nsec - ts0.tv_nsec) / 1000000);
}
`

const prologCode3 = `struct _print { void (*fptr)(value_t, value_t); const char* sig; } _print = { fbody_print, "(a)v" };
struct _print_i32 { void (*fptr)(value_t, int32_t); const char* sig; } _print_i32 = { fbody_print_i32, "(i)v" };
struct _performance_now { int32_t (*fptr)(value_t); const char* sig; } _performance_now = { fbody_performance_now, "()i" };
`


export function tempCFilePath(fname: string) {
  return `./temp-files/${fname}.c`;
}

export function tempExecutableFilePath(fname: string) {
  return `./temp-files/${fname}`;
}

export function initialCompile(destFile: string) {
  const result = transpile(0, prolog)
  fs.writeFileSync(destFile, prologCcode + prologCcode2 + prologCode3)
  return result;
}

export function compile(id: number, src: string, profiler: Profiler, destFile: string, globalNames?: GlobalVariableNameTable) {
  const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
    return new JitCodeGenerator(initializerName, codeId, moduleId, profiler, src);
  }
  const typeChecker = (maker: NameTableMaker<NameInfo>) => {
    return new JitTypeChecker(maker, undefined);
  }

  const ast = runBabelParser(src, 1)
  convertAst(ast, profiler);
  fs.writeFileSync('./temp-files/code.json', JSON.stringify(ast))
  const result = jitTranspile(id, ast, typeChecker, codeGenerator, globalNames, undefined)
  fs.writeFileSync(destFile, prologCcode + result.code);
  return result;
}

export function execute(inputFiles: string[], mainFuncNames: string[], lastCFile: string, outputFile: string): string {
  const lastCode = `
${prologCcode}
${mainFuncNames.map(mainFunc => `extern void ${mainFunc}();`).join('\n')}
  
int main() {
  gc_initialize();
  ${mainFuncNames.map(mainFunc => `try_and_catch(${mainFunc});`).join('\n')}  
}  
  `
  fs.writeFileSync(lastCFile, lastCode)
  execSync(`cc -g -DTEST64 -O2 ${inputFiles.map(f => `${f}`).join(' ')} ${lastCFile} ../microcontroller/core/src/c-runtime.c ../microcontroller/core/src/profiler.c -o ${outputFile}`)
  return execSync(outputFile).toString()
}

