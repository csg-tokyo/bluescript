import { transpile } from '../transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { GlobalVariableNameTable } from '../transpiler/code-generator/variables'
import { FILE_PATH } from '../constants'


const cProlog = `
#include <stdint.h>
#include "c-runtime.h"
`

const MODULES_DIR = '../modules'

const modules: Map<string, GlobalVariableNameTable> = new Map();
let globalNameTable = transpile(0, '').names;

function readModuleId(moduleName: string) {
  const moduleIds: {[name: string]: string} = JSON.parse(fs.readFileSync(FILE_PATH.MODULE_NAME_TO_ID(MODULES_DIR)).toString());
  const moduleId = moduleIds[moduleName];
  if (moduleId === undefined) {
    throw Error(`Cannot find module id corresponding to module name: ${moduleName}`);
  }
  return moduleId;
}

function main(moduleName: string) {
  const importer = (fname: string) => {
    const mod = modules.get(fname);
    if (mod)
      return mod;
    else {
      const ffi = fs.readFileSync(`${MODULES_DIR}/${fname}/${fname}.bs`).toString();
      const moduleId = readModuleId(fname);
      const result = transpile(0, ffi, globalNameTable, importer, moduleId);
      modules.set(fname, result.names);
      return result.names;
    }
  }

  const src = fs.readFileSync(`${MODULES_DIR}/${moduleName}/${moduleName}.bs`).toString()
  const result = transpile(0, src, globalNameTable, importer, readModuleId(moduleName)).code
  fs.writeFileSync(`${MODULES_DIR}/${moduleName}/${moduleName}.c`, cProlog + result)
  console.log('done')
}

main(process.argv[2]);