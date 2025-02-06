import { transpile } from '../transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { GlobalVariableNameTable } from '../transpiler/code-generator/variables'
import { FILE_PATH } from '../constants'
import Session from "../server/session";


const cProlog = `
#include <stdint.h>
#include "../${FILE_PATH.C_RUNTIME_H}"
#include "../${FILE_PATH.PROFILER_H}"
`

function main(moduleName: string) {
  const src = fs.readFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.bs`).toString()
  const result = transpile(0, src, undefined, undefined, Session.moduleNameToId(moduleName)).code
  fs.writeFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.c`, cProlog + result)
  console.log('done')
}

main(process.argv[2]);