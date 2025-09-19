import * as fs from 'fs'
import * as path from 'path'
import { GlobalVariableNameTable } from "./code-generator/variables";
import { transpile } from './code-generator/code-generator'

export abstract class Transpiler {
  baseGlobalNames?: GlobalVariableNameTable
  sessionId: number
  moduleId: number
  modules: Map<string, GlobalVariableNameTable>

  constructor(sessionId: number, names?: GlobalVariableNameTable) {
    this.baseGlobalNames = names
    this.sessionId = sessionId
    this.moduleId = 0
    this.modules = new Map<string, GlobalVariableNameTable>()
  }

  static fileRead(fname: string) {
    try {
      if (!fs.existsSync(fname))
        fname += '.ts'

      return fs.readFileSync(fname).toString('utf-8')
    }
    catch (e) {
      throw `cannot find a module ${fname}`
    }
  }

  getBaseGlobalNames() {
    if (!this.baseGlobalNames)
      throw 'baseGlobalNames is not set'

    return this.baseGlobalNames
  }
  
  abstract compileModule(code: string, main: string): void

  abstract compileCode(code: string, main: string): void

  makeImporter(baseName: string) {
    return (name: string) => {
      const fname = path.isAbsolute(name) ? name : path.join(baseName, name)
      const mod = this.modules.get(fname)
      if (mod)
        return mod
      else {
        const program = Transpiler.fileRead(fname)
        this.moduleId += 1
        this.sessionId += 1
        const result = transpile(this.sessionId, program, this.baseGlobalNames, this.makeImporter(path.dirname(fname)), this.moduleId)
        this.modules.set(fname, result.names)
        this.compileModule(result.code, result.main)
        return result.names
      }
    }
  }

  transpile(code: string, globalNames: GlobalVariableNameTable, dirname: string) {
    this.sessionId += 1
    const result = transpile(this.sessionId, code, globalNames, this.makeImporter(dirname))
    this.compileCode(result.code, result.main)
    return result.names
  }

  static transpile(sessionId: number, code: string) {
    return transpile(sessionId, code)
  }
}
