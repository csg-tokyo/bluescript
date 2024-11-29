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

function transpileModule(src: string) {
  let sessionId = 0
  let baseGlobalNames = new GlobalVariableNameTable()
  const modules = new Map<string, GlobalVariableNameTable>()

  const importer = (fname: string) => {
    const mod = modules.get(fname);
    if (mod)
      return mod;
    else {
      const ffi = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}/${fname}.bs`).toString();
      const moduleId = Session.moduleNameToId(fname);
      sessionId += 1;
      const result = transpile(0, ffi, baseGlobalNames, importer, moduleId);
      modules.set(fname, result.names)
      return result.names
    }
  }

  return transpile(sessionId, src, baseGlobalNames, importer).code
}



function main(moduleName: string) {
  const src = fs.readFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.bs`).toString()
  const result = transpileModule(src)
  fs.writeFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.c`, cProlog + result)
  console.log('done')
}

main(process.argv[2]);