import { runBabelParser, ErrorLog } from '../../src/transpiler/utils'
import { runTypeChecker } from "../../src/transpiler/type-checker";
import { BasicGlobalNameTable, NameInfo } from "../../src/transpiler/names";

export function transpile(src: string, startLine: number = 1, fileName?: string, src2?: string) {
  let importer = (name: string) => {
    if (name === fileName && src2) {
      const globalNameTable = new BasicGlobalNameTable()
      transpile0(src2, globalNameTable, startLine)
      return globalNameTable
    }
    else
      throw `cannot find a module ${name}`
  }

  const globalNameTable = new BasicGlobalNameTable()
  try {
    return transpile0(src, globalNameTable, startLine, importer)
  }
  catch (e) {
    if (e instanceof ErrorLog)
      throw e.toString()
    else
      throw e
  }
}

function transpile0(src: string, table: BasicGlobalNameTable, startLine: number, importer?: (f: string) => BasicGlobalNameTable) {
  const ast = runBabelParser(src, startLine);
  runTypeChecker(ast, table, importer)
  return ast
}
