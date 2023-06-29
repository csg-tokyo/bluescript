import { transpile } from '../src/transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prolog = `// predefined native functions
function console_log() {}
function console_log_float(f: float) {}
function sqrt(target: float): float { return 0.0 }
function get_time_ms(): float { return 0.0 }
`

const prologCcode = `
#include <stdio.h>
#include "../experiment/c-runtime.h"
#include "../experiment/utils.h"

`

function getEpilog(initName: string) {
  return `
int main() {
  gc_initialize();
  return try_and_catch(${initName});
}
`
}

test("Compile sample code", () => {
  const result1 = transpile(1, prolog)
  let globalNames = result1.names
  const src = fs.readFileSync("./experiment/nbody.ts").toString();
  const result2 = transpile(2, src, globalNames)
  globalNames = result2.names
  const destFile = './temp-files/bscript.c'
  fs.writeFileSync(destFile, prologCcode + result2.code + getEpilog(result2.main));
  // throw an Error when compilation fails.
  execSync(`cc -DBIT64 -g -O2 ${destFile} ./experiment/c-runtime.c ./experiment/utils.c  -o ./temp-files/bscript.o`)
})
