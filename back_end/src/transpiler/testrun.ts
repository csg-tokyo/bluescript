import { runBabelParser } from './utils'
import { runTypeChecker } from './type-checker/type-checker'
import { GlobalNameTable, NameInfo } from './type-checker/names'
import { transpile } from './code-generator/code-generator'
import { ErrorLog } from './utils'
import * as fs from 'fs'

export function runTypecheck(src: string, startLine: number = 1) {
    const ast = runBabelParser(src, startLine);

    const globalNameTable = new GlobalNameTable<NameInfo>()
    try {
        runTypeChecker(ast, globalNameTable)
        return ast
    }
    catch (e) { return e }
}

export function compile(file: string) {
  const src = fs.readFileSync(file,'utf8')
  console.log(file)
  console.log('=====')
  try {
    const code = transpile(src)
    console.log(code)
  }
  catch (e) {
    if (e instanceof ErrorLog)
      console.log(e.toString())
    else
      throw e
  }
}

// compile(process.argv[2])
compile('./dist/src/transpiler/test.ts')
