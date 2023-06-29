import { runBabelParser, ErrorLog } from '../../../src/transpiler/utils'
import { runTypeChecker } from "../../../src/transpiler/type-checker/type-checker";
import { BasicGlobalNameTable, NameInfo } from "../../../src/transpiler/type-checker/names";

export function transpile(src: string, startLine: number = 1) {
  try {
    const ast = runBabelParser(src, startLine);
    const globalNameTable = new BasicGlobalNameTable()
    runTypeChecker(ast, globalNameTable)
    return ast
  }
  catch (e) {
    if (e instanceof ErrorLog)
      throw e.toString()
    throw e
  }
}
