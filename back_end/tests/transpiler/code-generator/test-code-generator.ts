import { transpile } from '../../../src/transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prolog = `// predefined native functions
function print(m: any) {}
`

const prologCcode = `/* To compile, cc -DBIT64 this_file.c c-runtime.c */
#include <stdio.h>
#include "../../m5stack_bluetooth/main/c-runtime.h"

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

function getEpilog(initName: string) {
  return `
int main() {
  gc_initialize();
  return try_and_catch(${initName});
}
`
}

export function compileAndRun(src: string) {
    const result1 = transpile(1, prolog)
    let globalNames = result1.names
    const result2 = transpile(2, src, globalNames)
    globalNames = result2.names
    const destFile = './temp-files/bscript.c'
    fs.writeFileSync(destFile, prologCcode + result2.code + getEpilog(result2.main));
    // throw an Error when compilation fails.
    execSync(`cc -DBIT64 -g -O2 ${destFile} ../m5stack_bluetooth/main/c-runtime.c -o ./temp-files/bscript.o`)
    return execSync(`./temp-files/bscript.o`).toString()   // returns the printed text
}

export function compileFileAndRun() {
    const result1 = transpile(1, prolog)
    let globalNames = result1.names
    const src = fs.readFileSync("./sample/nbody.ts").toString();
    const result2 = transpile(2, src, globalNames)
    globalNames = result2.names
    const destFile = './temp-files/bscript.c'
    fs.writeFileSync(destFile, prologCcode + result2.code + getEpilog(result2.main));
    // throw an Error when compilation fails.
    execSync(`cc -DBIT64 -g -O2 ${destFile} ../m5stack_bluetooth/main/c-runtime.c -o ./temp-files/bscript.o`)
    return execSync(`./temp-files/bscript.o`).toString()   // returns the printed text
}
