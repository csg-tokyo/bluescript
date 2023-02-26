import {runBabelParser} from '../../../src/transpiler/utils'
import {runTypeChecker} from "../../../src/transpiler/type-checker/type-checker";
import {GlobalNameTable} from "../../../src/transpiler/type-checker/names";

export function transpile(src: string, startLine: number = 1) {
    const ast = runBabelParser(src, startLine);

    const globalNameTable = new GlobalNameTable()
    runTypeChecker(ast, globalNameTable)
    return ast
}
