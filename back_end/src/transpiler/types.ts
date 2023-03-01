export const Integer = 'integer'
export const Float = 'float'
export const Boolean = 'boolean'
export const String = 'string'
export const Void = 'void'
export const Null = 'null'
export const Any = 'any'

export type StaticType = 'integer' | 'float' | 'boolean' | 'string' | 'void' | 'null' | 'any' |
  ObjectType | FunctionType

export class ObjectType {
  name() {
    return 'object'
  }

  isSubtypeOf(t: StaticType): boolean {
    return this === t
  }

  sameType(t: StaticType): boolean {
    return this === t
  }
}

export const objectType = new ObjectType()

export class FunctionType extends ObjectType {
  returnType: StaticType
  paramTypes: StaticType[]

  constructor(returnType: StaticType, paramTypes: StaticType[]) {
    super()
    this.returnType = returnType
    this.paramTypes = paramTypes
  }

  name() {
    return `${this.paramTypes.map(typeToString)} -> ${typeToString(this.returnType)}`
  }

  isSubtypeOf(t: StaticType): boolean {
    if (t instanceof FunctionType)
      if (isSubtype(this.returnType, t.returnType)
        && this.paramTypes.length === t.paramTypes.length) {
        for (let i = 0; i < this.paramTypes.length; i++)
          if (!isSubtype(t.paramTypes[i], this.paramTypes[i]))
            return false
        return true
      }

    return false
  }

  sameType(t: StaticType): boolean {
    if (t instanceof FunctionType)
      if (sameType(this.returnType, t.returnType)
        && this.paramTypes.length === t.paramTypes.length) {
        for (let i = 0; i < this.paramTypes.length; i++)
          if (!sameType(t.paramTypes[i], this.paramTypes[i]))
            return false
        return true
      }

    return false
  }
}

export class ArrayType extends ObjectType {
  elementType: StaticType

  constructor(element: StaticType) {
    super()
    this.elementType = element
  }

  name() {
    return `${typeToString(this.elementType)}[]`
  }

  isSubtypeOf(t: StaticType): boolean {
    if (t instanceof ArrayType)
      return isSubtype(this.elementType, t.elementType)

    return false
  }

  sameType(t: StaticType): boolean {
    if (t instanceof ArrayType)
      return sameType(this.elementType, t.elementType)

    return false
  }
}

export function typeToString(type: StaticType): string {
  if (type instanceof ObjectType)
    return type.name()
  else
    return type
}

// t1 is a subtype of t2 when a t1 value is assignable to a t2 variable without explicit conversion
// with respect to its implementation in the C language.  We here assume that coercion is implicit
// conversion.
export function isSubtype(subtype: StaticType, type: StaticType): boolean {
  if (type === subtype)
    return true     // subclassing has not been implemented yet.
  else if (subtype === Integer && type === Float
    || subtype === String && type === objectType)
    return true
  else if (type === Boolean)
    return subtype !== Void && subtype !== Any
  else if (subtype instanceof ObjectType)
    return subtype.isSubtypeOf(type)
  else
    return false
}

export function sameType(t1: StaticType, t2: StaticType) {
  if (t1 === t2)
    return true
  else if (t1 instanceof ObjectType)
    return t1.sameType(t2)
  else
    return false
}

// isConsistent(t1, t2) is true when a t1 value is assignable to a t2 variable
// after explicit conversion.  That conversion may throw a runtime type error.
export function isConsistent(t1: StaticType, t2: StaticType) {
  if (t1 === Any || t2 === Any)
    return t1 !== t2
  else
    return false
}

export function commonSuperType(t1: StaticType, t2: StaticType): StaticType | undefined {
  if (isSubtype(t1, t2))
    return t2
  else if (isSubtype(t2, t1))
    return t1
  else
    return undefined
}

export function isValueT(t: StaticType | undefined): boolean {
  const noValueT: any[] = ["integer", "float", "boolean", "void", "null"]
  return t !== undefined && !noValueT.includes(t);
}