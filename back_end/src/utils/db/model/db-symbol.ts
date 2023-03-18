
export type DBSymbol = {
  name: string,
  type?: DBType,
  address: number,
  cDeclaration: string
}

export type DBType = DBPrimitiveTypes | DBFunctionType | DBObjectTye | DBArrayType

export type DBPrimitiveTypes = {
  kind: "primitive",
  type: 'integer' | 'float' | 'boolean' | 'string' | 'void' | 'null' | 'any'
}

export type DBFunctionType = {
  kind: "function",
  returnType: DBType,
  params: DBType[]
}

export type DBObjectTye = {
  kind: "object"
}

export type DBArrayType = {
  kind: "array"
  element: DBType
}