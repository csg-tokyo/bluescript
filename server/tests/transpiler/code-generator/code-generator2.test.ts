import { execSync } from 'child_process'
import { compileAndRun, multiCompileAndRun, importAndCompileAndRun, transpileAndWrite } from './test-code-generator'
import { describe, expect, test, beforeAll } from '@jest/globals'
import { GlobalVariableNameTable } from '../../../src/transpiler/code-generator/variables'
import exp from 'constants'

beforeAll(() => {
  execSync('mkdir -p ./temp-files')
})

class Importer {
  moduleId: number
  modules: { name: string, source: string }[]
  nameTable?: GlobalVariableNameTable
  fileNames: { file: string, main: string }[]

  constructor(mods: { name: string, source: string }[]) {
    this.modules = mods
    this.moduleId = 0
    this.fileNames = []
  }

  init() {
    return (n: GlobalVariableNameTable) => this.nameTable = n
  }

  reset() {
    this.moduleId = 0
    this.fileNames = []
  }

  importer() {
    const importerFunction = (f: string) => {
      const mod = this.modules.find((v, i, obj) => v.name === f)
      if (mod === undefined)
          throw `cannot find a module ${f}`

      this.moduleId += 1
      const fname =  `./temp-files/m${this.moduleId}_bscript.c`
      const result = transpileAndWrite(1, mod.source, fname,
                                       this.nameTable, this.moduleId, importerFunction)
      this.fileNames.push({ file: fname, main: result.main })
      return result.names
    }
    return importerFunction
  }

  files() { return () => this.fileNames }
}

test('import declaration', () => {
  const modules = [
    { name: 'foo', source: `
  export const foobaz = 3
  export const foobaz2 = 'foo'
` },
    { name: 'bar', source: `
  const g = 'bar'
  export function barf(x: integer) { return x }
  export function getg() { return g }
` }]

  const src = `
import { foobaz } from 'foo'
print(foobaz)
`
  const imp = new Importer(modules)
  expect(importAndCompileAndRun(src, imp.importer(), imp.init(), imp.files(), './temp-files/bscript')).toBe('3\n')

  const src2 = `
import { barf } from 'bar'
print(barf(5))
`
  imp.reset()
  expect(importAndCompileAndRun(src2, imp.importer(), imp.init(), imp.files(), './temp-files/bscript')).toBe('5\n')

  const src3 = `
import { foobaz2 } from 'foo'
import { getg } from 'bar'

const g = 'src3'
function barf() {
  print(g)
  print(getg())
  print(foobaz2)
}

barf()
`
  imp.reset()
  expect(importAndCompileAndRun(src3, imp.importer(), imp.init(), imp.files(), './temp-files/bscript')).toBe('src3\nbar\nfoo\n')
})
