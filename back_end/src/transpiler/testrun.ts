import { runBabelParser } from './utils'
import { runTypeChecker } from './type-checker/type-checker'
import { BasicGlobalNameTable, NameInfo } from './type-checker/names'
import { transpile } from './code-generator/code-generator'
import { ErrorLog } from './utils'
import * as fs from 'fs'

export function print(m: string) {}

export function runTypecheck(src: string, startLine: number = 1) {
    const ast = runBabelParser(src, startLine);
    const globalNameTable = new BasicGlobalNameTable()
    try {
        runTypeChecker(ast, globalNameTable)
        return ast
    }
    catch (e) { return e }
}

const prolog = `// predefined native functions
function print(m: any) {}
`

const prologCcode = `/* To compile, cc -DBIT64 this_file.c c-runtime.c */

#include <stdio.h>
#include "src/transpiler/code-generator/c-runtime.h"

static void _print(value_t m) {
  if (is_int_value(m))
    printf("%d\\n", value_to_int(m));
  else if (is_float_value(m))
    printf("%f\\n", value_to_float(m));
  else if (gc_is_string_literal(m))
    puts(gc_string_literal_cstr(m));
  else
    puts("??");
}
`

function printEpilog(initName: string) {
  console.log(`
int main() {
  gc_initialize();
  return try_and_catch(${initName});
}
`)
}

export function compile(file: string) {
  const src = fs.readFileSync(file,'utf8')
  console.log('/* source file:', file, '*/')
  try {
    // compile predefined native functions
    // and retrieve a name table.
    const result1 = transpile(1, prolog)
    let globalNames = result1.names
    const result2 = transpile(2, src, globalNames)
    globalNames = result2.names
    console.log(prologCcode)
    console.log(result2.code)
    printEpilog(result2.main)
  }
  catch (e) {
    if (e instanceof ErrorLog)
      console.log(e.toString())
    else
      throw e
  }
}

// compile(process.argv[2])
// compile('./test.ts')
