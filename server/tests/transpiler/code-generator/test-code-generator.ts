import { transpile } from '../../../src/transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { execSync } from 'child_process'
import { ErrorLog } from '../../../src/transpiler/utils'
import { GlobalVariableNameTable } from '../../../src/transpiler/code-generator/variables'

const prolog = `// predefined native functions
function print(m: any) {}
function print_i32(m: integer) {}
function performance_now(): integer { return 0 }
`

const prologCcode = `/* To compile, cc -DTEST64 this_file.c c-runtime.c */
#include "../../microcontroller/core/include/c-runtime.h"

`
const prologCcode2 = `
#include <stdio.h>
#include <time.h>

static void fbody_print(value_t self, value_t m) {
  if (is_int_value(m))
    printf("%d\\n", value_to_int(m));
  else if (is_float_value(m))
    printf("%f\\n", value_to_float(m));
  else if (m == VALUE_NULL)
    puts("null");
  else if (gc_is_string_literal(m))
    puts(gc_string_literal_cstr(m));
  else
    puts("??");
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

const prologCode2a = `struct _print _print = { fbody_print, "(a)v" };
`

const prologCode2b = `struct _print _print = { fbody_print, "(a)v" };
struct _print_i32 _print_i32 = { fbody_print_i32, "(i)v" };
`

const prologCode2c = `struct _print { void (*fptr)(value_t, value_t); const char* sig; } _print = { fbody_print, "(a)v" };
struct _print_i32 { void (*fptr)(value_t, int32_t); const char* sig; } _print_i32 = { fbody_print_i32, "(i)v" };
struct _performance_now { int32_t (*fptr)(value_t); const char* sig; } _performance_now = { fbody_performance_now, "()i" };
`

function getEpilog(initName: string) {
  return `
int main() {
  gc_initialize();
  return try_and_catch(${initName});
}
`
}

function getEpilog2(initName: string, initName2: string) {
  return `
int main() {
  gc_initialize();
  int r = try_and_catch(${initName});
  if (r > 0)
    return r;
  else
    return try_and_catch(${initName2});
}
`
}

// This function is obsolete.
// all the code is saved in a single file bscript.c.  only print() and print_i32() are available.
// print() must be called at least once in the given source code.
export function compileAndRunWithSingleFile(src: string, usePrintI32 = false, destFile = './temp-files/bscript.c') {
    const result1 = transpile(1, prolog)
    let globalNames = result1.names
    let result2
    try {
      result2 = transpile(2, src, globalNames, 1, prologCcode2 + (usePrintI32 ? prologCode2b : prologCode2a))
    }
    catch (e) {
      if (e instanceof ErrorLog)
        throw e.toString()
      throw e
    }
    globalNames = result2.names
    fs.writeFileSync(destFile, prologCcode + result2.code + getEpilog(result2.main))
    // throw an Error when compilation fails.
    execSync(`cc -g -DTEST64 -O2 ${destFile} ../microcontroller/core/src/c-runtime.c -o ./temp-files/bscript`)
    return execSync(`./temp-files/bscript`).toString()   // returns the printed text
}

// This generates two files bscript1.c and bscript2.c.
export function compileAndRun(src: string, destFile = './temp-files/bscript') {
  const result1 = transpile(1, prolog)
  const firstFile = destFile + '1.c'
  fs.writeFileSync(firstFile, prologCcode + prologCcode2 + prologCode2c)
  let globalNames = result1.names

  const result2 = runTranspiler(2, src, globalNames)
  const secondFile = destFile + '2.c'
  fs.writeFileSync(secondFile, prologCcode + result2.code + getEpilog(result2.main))
  // throw an Error when compilation fails.

  execSync(`cc -g -DTEST64 -O2 ${firstFile} ${secondFile} ../microcontroller/core/src/c-runtime.c -o ./temp-files/bscript`)
  return execSync(`./temp-files/bscript`).toString()   // returns the printed text
}

export function multiCompileAndRun(src: string, src2: string, destFile = './temp-files/bscript') {
  const result1 = transpile(1, prolog)
  const firstFile = destFile + '1.c'
  fs.writeFileSync(firstFile, prologCcode + prologCcode2 + prologCode2c)
  let globalNames = result1.names

  const result2 = runTranspiler(2, src, globalNames)
  const secondFile = destFile + '2.c'
  fs.writeFileSync(secondFile, prologCcode + result2.code)
  globalNames = result2.names

  const result3 = runTranspiler(3, src2, globalNames)
  const thirdFile = destFile + '3.c'
  const protoMain2 = `extern void ${result2.main}();\n`
  fs.writeFileSync(thirdFile, prologCcode + protoMain2 + result3.code + getEpilog2(result2.main, result3.main))
  // throw an Error when compilation fails.

  execSync(`cc -g -DTEST64 -O2 ${firstFile} ${secondFile} ${thirdFile} ../microcontroller/core/src/c-runtime.c -o ./temp-files/bscript`)
  return execSync(`./temp-files/bscript`).toString()   // returns the printed text
}

function runTranspiler(id: number, src: string, names: GlobalVariableNameTable) {
  try {
    return transpile(id, src, names)
  }
  catch (e) {
    if (e instanceof ErrorLog)
      throw e.toString()
    throw e
  }
}
