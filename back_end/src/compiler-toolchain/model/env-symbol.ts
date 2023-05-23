import {ArrayType, FunctionType, ObjectType, StaticType} from "../../transpiler/types";
import {DBSymbol, DBType} from "../../utils/db/model/db-symbol";

export type EnvSymbol = {
  name: string,
  type?: StaticType,
  address: number,
  cDeclaration: string
}

export type EnvNewSymbol = {
  name?: string,
  type?: StaticType,
  address?: number,
  cDeclaration?: string
}

export function dbSymbolsToEnvSymbols(dbSymbols: DBSymbol[]): EnvSymbol[] {
  const result: EnvSymbol[] = [];
  for (const dbSymbol of dbSymbols) {
    const envSymbol: EnvSymbol = {
        name: dbSymbol.name,
        address: dbSymbol.address,
        cDeclaration: dbSymbol.cDeclaration
    }
    if (dbSymbol.type)
      envSymbol.type = dbTypeToStaticType(dbSymbol.type)
    result.push(envSymbol);
  }
  return result;
}

export function dbTypeToStaticType(dbType: DBType): StaticType {
  switch (dbType.kind) {
    case "primitive":
      return dbType.type
    case "function":
      return new FunctionType(dbTypeToStaticType(dbType.returnType), dbType.params.map(x => dbTypeToStaticType(x)));
    case "array":
      return new ArrayType(dbTypeToStaticType(dbType.element));
    case "object":
      throw Error("object type other than array type has not supported yet.");
    default:
      throw Error("unknown type was passed.");
  }
}

export function envNewSymbolsToDBSymbols(envNewSymbols: EnvNewSymbol[]): DBSymbol[] {
  const result: DBSymbol[] = [];
  for (const symbol of envNewSymbols) {
    if (!symbol.name || !symbol.address || !symbol.cDeclaration)
      throw new Error("malformed symbol passed.");
    const dbSymbol:DBSymbol = {
      name: symbol.name,
      type: symbol.type ? staticTypeToDBType(symbol.type) : undefined,
      address: symbol.address,
      cDeclaration: symbol.cDeclaration
    }
    result.push(dbSymbol);
  }
  return result;
}

export function staticTypeToDBType(staticType: StaticType): DBType {
  if (staticType instanceof FunctionType) {
    return {
      kind: "function",
      returnType: staticTypeToDBType(staticType.returnType),
      params: staticType.paramTypes.map(x => staticTypeToDBType(x))
    }
  } else if (staticType instanceof ArrayType) {
    return {
      kind: "array",
      element: staticTypeToDBType(staticType.elementType)
    }
  } else if (staticType instanceof ObjectType) {
    throw Error("object type other than array type has not supported yet.");
  } else {
    return {
      kind: "primitive",
      type: staticType
    }
  }
}