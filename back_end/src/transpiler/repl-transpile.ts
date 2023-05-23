import {runBabelParser} from "./utils";
import {GlobalNameTable, NameInfo} from "./type-checker/names";
import {runTypeChecker} from "./type-checker/type-checker";
import * as visitor from "./visitor";
import {ReplCodeGenerator, ReplGlobalRootSet} from "./code-generator/repl-code-generator";
import {ArrayType, FunctionType, ObjectType, StaticType} from "./types";
import {EnvNewSymbol} from "../compiler-toolchain/model/env-symbol";
import {staticTypeToCType} from "./code-generator/code-generator";

export function replTranspile(tsString: string, existingSymbols: {name: string, type: StaticType}[]):{cString: string, newSymbols: EnvNewSymbol[], execFuncNames:string[]} {
  const ast = runBabelParser(tsString, 1);

  const globalNameTable = new GlobalNameTable();
  for (const symbol of existingSymbols)
    globalNameTable.record(symbol.name, new NameInfo(symbol.type));
  runTypeChecker(ast, globalNameTable);

  const codeGenerator = new ReplCodeGenerator();
  const rootSet = new ReplGlobalRootSet(globalNameTable);
  visitor.file(ast, rootSet, codeGenerator);

  const cString = codeGenerator.result;
  const newSymbols: EnvNewSymbol[] = generateNewSymbols(globalNameTable, existingSymbols);
  const execFuncNames = rootSet.execFunctionNames;

  return {cString, newSymbols, execFuncNames};
}

function generateNewSymbols(nameTable: GlobalNameTable, existingSymbols: {name: string, type: StaticType}[]): EnvNewSymbol[] {
  const existingSymbolsSet = new Set(existingSymbols.map(s => s.name));
  const newSymbols:EnvNewSymbol[] = [];
  for (const [name, nameInfo] of Object.entries(nameTable.names)) {
    if (existingSymbolsSet.has(name))
      continue;
    const symbol:EnvNewSymbol = {
      name,
      type: nameInfo.type,
      cDeclaration: generateCDeclaration(name, nameInfo)
    };
    newSymbols.push(symbol);
  }
  return newSymbols;
}

function generateCDeclaration(name: string, info: NameInfo):string {
  let cDec = "";
  if (info.type instanceof FunctionType) {
    cDec += `${staticTypeToCType(info.type.returnType)} ${name}(`;
    for (let i = 0; i < info.type.paramTypes.length; i++) {
      cDec += `${staticTypeToCType(info.type.paramTypes[i])} p${i},`
    }
    if (info.type.paramTypes.length > 0)
      cDec = cDec.slice(0, -2);
    cDec += ");";
  } else if (info.type instanceof ArrayType) {
    cDec += `extern ${staticTypeToCType(info.type.elementType)}[] ${name};`;
  } else if (info.type instanceof ObjectType) {
    throw new Error("object type other than array and string hasn't been supported yet.");
  } else {
    cDec += `extern ${staticTypeToCType(info.type)} ${name};`;
  }
  return cDec;
}