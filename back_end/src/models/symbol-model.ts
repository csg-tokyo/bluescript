import AvailableType from "./available-type";

export type SymbolModel = {
  name: string,
  address?: number
  declaration: string,
  access: "internal" | "public",
  type?: VariableTypeModel | FunctionTypeModel
}


// TODO: initial-dataの中にvariableTypeが入っていないものがあるのにどう対処する？
export type VariableTypeModel = {
  symbolType: "variable",
  variableType: AvailableType
}

export type FunctionTypeModel = {
  symbolType: "function",
  returnType: AvailableType,
  params: {name: string, type: AvailableType}[]
}