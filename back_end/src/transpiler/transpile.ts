import {runBabelParser} from './utils'
import * as visitor from "./visitor";
import {CodeGenerator} from "./code-generator/code-generator";
import {runTypeChecker} from "./type-checker/type-checker";
import {GlobalNameTable, NameInfo} from "./type-checker/names";
import {GlobalRootSet} from "./code-generator/root-set";
import {StaticType} from "./types";

export function transpile(src: string, existingSymbols: {name: string, type: StaticType}[]): string {
    const ast = runBabelParser(src, 1);

    const globalNameTable = new GlobalNameTable();
    for (const symbol of existingSymbols) {
        globalNameTable.record(symbol.name, new NameInfo(symbol.type));
    }
    runTypeChecker(ast, globalNameTable)

    const codeGenerator = new CodeGenerator();
    const rootSet = new GlobalRootSet(globalNameTable);
    visitor.file(ast, rootSet, codeGenerator);

    return codeGenerator.result;
}