import {runBabelParser} from './utils'
import * as visitor from "./visitor";
import {CodeGenerator} from "./code-generator/code-generator";
import {runTypeChecker} from "./type-checker/type-checker";
import {GlobalNameTable} from "./type-checker/names";
import {GlobalRootSet} from "./code-generator/root-set";

export function transpile(src: string, startLine: number = 1): string {
    const ast = runBabelParser(src, startLine);

    const globalNameTable = new GlobalNameTable()
    runTypeChecker(ast, globalNameTable)

    const codeGenerator = new CodeGenerator();
    const rootSet = new GlobalRootSet(globalNameTable);
    visitor.file(ast, rootSet, codeGenerator);

    return codeGenerator.result;
}