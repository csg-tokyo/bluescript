import {SymbolModel} from "../models/symbol-model";
import {runBabelParser} from "./utils";
import {GlobalNameTable} from "./type-checker/names";
import {runTypeChecker} from "./type-checker/typechecker";
import * as visitor from "./visitor";
import {ReplCodeGenerator, ReplGlobalRootSet} from "./code-generator/repl-code-generator";
import AvailableType from "../models/available-type";
import {staticTypeToCType} from "./code-generator/code-generator";

export function replTranspile(tsString: string, existingSymbols: SymbolModel[]):{cString: string, newSymbols: SymbolModel[], execFuncNames:string[]} {
  const ast = runBabelParser(tsString, 1);

  const globalNameTable = new GlobalNameTable();
  for (const symbol of existingSymbols) {
    if (symbol.type?.symbolType === "variable")
      globalNameTable.record(symbol.name, symbol.type.variableType);
  }
  runTypeChecker(ast, globalNameTable);

  const codeGenerator = new ReplCodeGenerator();
  const rootSet = new ReplGlobalRootSet(countExistingObjects(existingSymbols));
  visitor.file(ast, rootSet, codeGenerator);

  const cString = codeGenerator.result;
  const newSymbols: SymbolModel[] = generateNewSymbols(globalNameTable, existingSymbols);
  const execFuncNames = rootSet.execFunctionNames;

  return {cString, newSymbols, execFuncNames};
}

function countExistingObjects(existingSymbols: SymbolModel[]): number {
  let count = 0;
  for (const symbol of existingSymbols) {
    if (symbol.type?.symbolType === "variable" && ["string"].includes(symbol.type.variableType))
      count++;
  }
  return count;
}

function generateNewSymbols(nameTable: GlobalNameTable, existingSymbols: SymbolModel[]): SymbolModel[] {
  // TODO: Functionに対応
  const existingSymbolsSet = new Set(existingSymbols.map(s => s.name));
  const newSymbols:SymbolModel[] = [];
  for (const [name, nameInfo] of nameTable.names) {
    if (existingSymbolsSet.has(name))
      continue;
    const symbol:SymbolModel = {
      access: "public",
      declaration: `${staticTypeToCType(nameInfo.type)} ${name};`,
      name,
      type: {
        symbolType: "variable",
        variableType: nameInfo.type as AvailableType
      }
    };
    newSymbols.push(symbol);
  }
  return newSymbols;
}