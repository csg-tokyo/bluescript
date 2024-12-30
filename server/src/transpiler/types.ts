// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import { InstanceType } from "./classes"

export const Integer = 'integer'
export const Float = 'float'
export const BooleanT = 'boolean'
export const StringT = 'string'
export const Void = 'void'
export const Null = 'null'
export const Any = 'any'

export const ByteArrayClass = 'Uint8Array'

export type StaticType = 'integer' | 'float' | 'boolean' | 'string' | 'void' | 'null' | 'any' |
  ObjectType | FunctionType | UnionType

export function isPrimitiveType(type: StaticType) {
  // unless String, Null, FunctionType, Any, or object type
  return type === Integer || type === Float || type === BooleanT || type === Void
}

export function isNumeric(t: StaticType) {
  return t === Integer || t === Float
}

// the common super class of ObjectType and FunctionType
abstract class CompositeType {
  abstract name(): string
  abstract isSubtypeOf(t: StaticType): boolean
  abstract sameType(t: StaticType): boolean

  sourceName() { return this.name() }
}

// A singleton class.
// This class and its subclasses represent value_t values.
export class ObjectType extends CompositeType {
  name() {
    return 'object'
  }

  isSubtypeOf(t: StaticType): boolean {
    return this === t || this.superType()?.isSubtypeOf(t) || false
  }

  sameType(t: StaticType): boolean {
    return this === t
  }

  superType(): ObjectType | null { return null }
}

export const objectType = new ObjectType()

// this is one of primitive types
export class FunctionType extends CompositeType {
  returnType: StaticType
  paramTypes: StaticType[]

  constructor(returnType: StaticType, paramTypes: StaticType[]) {
    super()
    this.returnType = returnType
    this.paramTypes = paramTypes
  }

  name() {
    return `(${this.paramTypes.map(typeToString)}) => ${typeToString(this.returnType)}`
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
  static readonly lengthMethod = 'length'
  elementType: StaticType

  constructor(element: StaticType) {
    super()
    this.elementType = element
  }

  name() {
    return `${typeToString(this.elementType)}[]`
  }

  isSubtypeOf(t: StaticType): boolean {
    return this.sameType(t)
  }

  sameType(t: StaticType): boolean {
    if (t instanceof ArrayType)
      return sameType(this.elementType, t.elementType)

    return false
  }
}

export class UnionType extends CompositeType {
  types: StaticType[]

  constructor(types: StaticType[]) {
    super()
    this.types = types
  }

  name() {
    return this.types.map(t => typeToString(t)).join('|')
  }

  isSubtypeOf(t: StaticType): boolean {
    for (const sub of this.types)
      if (!isSubtype(sub, t))
        return false

    return true
  }

  isSuperTypeOf(t: StaticType): boolean {
    for (const sup of this.types)
      if (isSubtype(t, sup))
        return true

    return false
  }

  sameType(t: StaticType): boolean {
    if (t instanceof UnionType && t.types.length === this.types.length) {
      for (const e of t.types)
        if (!this.isOneOfTypes(e))
          return false

      return true
    }

    return false
  }

  private isOneOfTypes(t: StaticType) {
    for (const t2 of this.types)
      if (sameType(t, t2))
        return true

    return false
  }

  isNullable() {
    if (this.types.length !== 2)
      return undefined

    let index
    if (this.types[0] === Null)
      index = 1
    else if (this.types[1] === Null)
      index = 0
    else
      return undefined

    const t = this.types[index]
    if (t instanceof ObjectType || t === StringT)
      return t
    else
      return undefined
  }

  hasStringOrBoolean() {
    for (const t of this.types)
      if (t === StringT || t === BooleanT)
        return true

    return false
  }
}

// type name used for error messages
export function typeToString(type: StaticType): string {
  if (type instanceof CompositeType)
    return type.sourceName()
  else if (type === Null)
    return 'undefined'
  else
    return type
}

export function encodeType(type: StaticType): string {
  switch (type) {
  case Integer:
    return 'i'
  case Float:
    return 'f'
  case BooleanT:
    return 'b'
  case StringT:
    return 's'
  case Void:
    return 'v'
  case Null:
    return 'n'
  case Any:
    return 'a'
  default:
    if (type instanceof ArrayType)
      return '[' + encodeType(type.elementType)
    else if (type instanceof FunctionType)
      return `(${type.paramTypes.map(e => encodeType(e)).join('')})${encodeType(type.returnType)}`
    else if (type instanceof ObjectType)
      return `'${type.name()}'`
    else if (type instanceof UnionType)
      return '|' + type.types.map(e => encodeType(e)).join('')
    else
      throw new Error(`cannot encode: ${typeToString(type)}`)
  }
}

// t1 is a subtype of t2 when a t1 value is assignable to a t2 variable without explicit conversion
// with respect to its implementation in the C language.  We here assume that coercion is implicit
// conversion.
export function isSubtype(subtype: StaticType, type: StaticType): boolean {
  if (type === subtype)
    return true     // subclassing has not been implemented yet.
  else if (subtype instanceof UnionType)
    return subtype.isSubtypeOf(type)
  else if (type instanceof UnionType)
    return type.isSuperTypeOf(subtype)
  else if (subtype === Integer && type === Float
    || subtype === StringT && type === objectType)
    return true
  else if (type === BooleanT)
    return subtype === BooleanT
  else if (subtype instanceof CompositeType)
    return subtype.isSubtypeOf(type)
  else
    return false
}

export function sameType(t1: StaticType, t2: StaticType) {
  if (t1 === t2)
    return true
  else if (t1 instanceof CompositeType)
    return t1.sameType(t2)
  else
    return false
}

// isConsistent(t1, t2) is true when a t1 value is assignable to a t2 variable
// after explicit conversion.  That conversion may throw a runtime type error.
export function isConsistent(t1: StaticType, t2: StaticType) {
  if (t1 === Any)
    return t1 !== t2 && t2 !== Void
  else if (t2 === Any)
    return t1 !== Void
  else
    return false
}

export function commonSuperType(t1: StaticType, t2: StaticType): StaticType | undefined {
  if (t1 === Float && t2 === Integer)
    return Float
  else if (isSubtype(t1, t2))
    return t2
  else if (isSubtype(t2, t1))
    return t1
  else if (t1 instanceof ObjectType) {
    const s = t1.superType()
    if (s !== null)
      return commonSuperType(s, t2)
  }

  return undefined
}
