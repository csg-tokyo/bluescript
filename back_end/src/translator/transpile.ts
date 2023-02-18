import {runBabelParser} from './utils'
import {GlobalNameTable, Typechecker} from "./type-checker/typechecker";
import * as visitor from "./visitor";
import {CodeGenerator, GlobalRootSet} from "./code-generator/code-generator";

export function transpile(src: string): string {
    const ast = runBabelParser(src);

    const typechecker = new Typechecker();
    const nameTable = new GlobalNameTable();
    visitor.file(ast, nameTable, typechecker);

    const codeGenerator = new CodeGenerator();
    const rootSet = new GlobalRootSet();
    visitor.file(ast, rootSet, codeGenerator);

    return codeGenerator.result;
}