// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { ErrorLog } from '../utils'
import { Integer, Float, Boolean, String, Void, Null, Any,
    ObjectType, objectType, FunctionType,
    StaticType, isPrimitiveType, typeToString, ArrayType, noRuntimeTypeInfo, sameType, encodeType, } from '../types'

export const anyTypeInC = 'value_t'
export const funcTypeInC = 'value_t'
export const funcStructInC = 'struct func_body'

export const mainFunctionName = 'bluescript_main'
export const returnValueVariable = 'ret_value_'

export const uint32type = 'uint32_t'

export function funcTypeToCType(type: StaticType, name: string = ''): string {
  if (type instanceof FunctionType) {
    let typename = typeToCType(type.returnType)
    typename += ' (*'
    if (typename !== '')
      typename += name

    typename += ')(value_t'
    for (const param of type.paramTypes) {
      typename += ', '
      typename += typeToCType(param)
    }

    return typename + ')'
  }
  else
    return typeToCType(type, name)
}

export function typeToCType(type: StaticType, name: string = ''): string {
  if (name === '')
    return typeToCType2(type)
  else
    return `${typeToCType2(type)} ${name}`
}

function typeToCType2(type: StaticType): string {
  if (type instanceof FunctionType)
    return funcTypeInC
  else if (type instanceof ObjectType)
    return anyTypeInC
  else
    switch (type) {
    case Integer:
      return 'int32_t'
    case Float:
      return 'float'
    case Boolean:
      return 'int32_t'
    case Void:
      return 'void'
    case String:
    case Null:
    case Any:
      return anyTypeInC
    default:
      throw new Error(`${type} has not been supported yet.`)
  }
}

function typeConversionError(from: StaticType | undefined, to: StaticType | undefined,
                             node: AST.Node) {
  const fromType = from === undefined ? '?' : typeToString(from)
  const toType = to === undefined ? '?' : typeToString(to)
  return new ErrorLog().push(`internal error: cannot convert ${fromType} to ${toType}`, node)
}

// returns '(' or '<conversion function>('
// "from" or "to" is undefined when type conversion is unnecessary
export function typeConversion(from: StaticType | undefined, to: StaticType | undefined,
                               node: AST.Node) {
  if (from === undefined || to === undefined)
    return '('

  if (sameType(from, to))
    if (from === Integer)
      return '(int32_t)('
    else if (from === Float)
      return '(float)('
    else
      return '('

  if (from instanceof FunctionType && to === Any)
    return '('

  if (from === Any && to instanceof FunctionType)
    return `safe_value_to_func("${encodeType(to)}", `

  if (from instanceof FunctionType || from === Void || to instanceof FunctionType || to === Void)
    throw typeConversionError(from, to, node)

  switch (to) {
    case Integer:
      if (from === Float)
        return '(int32_t)('
      else if (from === Boolean)
        return '('
      else if (from === Any)
        return 'safe_value_to_int('
      else
        break
    case Float:
      if (from === Integer || from === Boolean)
        return '(float)('
      else if (from === Any)
        return 'safe_value_to_float('
      else
        break
    case Boolean:
      if (from === Integer || from === Float)
        return '('
      else if (from === Any)
        return 'safe_value_to_bool('
      else
        break
    case Null:
      if (from === Any)
        return 'safe_value_to_null('
      else
        break
    case Any:
      switch (from) {
        case Integer:
          return 'int_to_value('
        case Float:
          return 'float_to_value('
        case Boolean:
          return 'bool_to_value('
        default:
          return '('
      }
    default:    // "to" is either String, Object, or Array
      if (from === Any || from instanceof ObjectType) {
        if (to === String)
          return 'safe_value_to_string('
        else if (to instanceof ObjectType) {
          if (to === objectType)
            return 'safe_value_to_object('
          else if (to instanceof ArrayType) {
            if (to.elementType === Integer)
              return 'safe_value_to_intarray('
            else if (to.elementType === Float)
              return 'safe_value_to_floatarray('
            else if (to.elementType === Boolean)
              return 'safe_value_to_bytearray('
            else if (to.elementType === Any)
              return 'safe_value_to_anyarray('
            else
              break
              // cannot determine wether a given array
              //is an array of String or Any
          }

          const info = to.runtimeTypeInfo()
          if (info === noRuntimeTypeInfo)
            break

          return `safe_value_to_value(${info}, `
        }
      }
      else if (from === Null)
        return '('
      // else if (from === String), then this is an error.
  }

  throw typeConversionError(from, to, node)
}

// covert any, null, array, function type to a boolean value
export const convertToCondition = 'value_to_truefalse'

export function arithmeticOpForAny(op: string) {
  switch(op) {
    case '<':
      return 'any_less'     // returns boolean
    case '<=':
      return 'any_less_eq'
    case '>':
      return 'any_greater'
    case '>=':
      return 'any_greater_eq'
    case '+':
      return 'any_add'      // return any
    case '-':
      return 'any_subtract'
    case '*':
      return 'any_multiply'
    case '/':
      return 'any_divide'
    case '+=':
      return 'any_add_assign'
    case '-=':
      return 'any_subtract_assign'
    case '*=':
      return 'any_multiply_assign'
    case '/=':
      return 'any_divide_assign'
    default:
      throw new Error(`bad operator ${op}`)
  }
}

export function updateOpForAny(prefix: boolean, op: string) {
  if (prefix)
    if (op === '++')
      return 'any_increment'
    else
      return 'any_decrement'
  else
    if (op === '++')
      return 'any_post_increment'
    else
      return 'any_post_decrement'
}

// compute a nagative value of an any-type value
export const minusAnyValue = 'minus_any_value'

// Root set

export const globalRootSetName = 'global_rootset'

export function makeRootSet(n: number) {
  if (n > 0)
    return `ROOT_SET(func_rootset, ${n})`
  else
    return ''
}

export function declareRootSet(name: string, n: number) {
  return `ROOT_SET_DECL(${name}, ${n})`
}

export function initRootSet(name: string, n: number) {
  return `ROOT_SET_INIT(${name}, ${n})`
}

export function deleteRootSet(n: number) {
  if (n > 0)
    return 'DELETE_ROOT_SET(func_rootset)'
  else
    return ''
}

export function rootSetVariable(index: number | undefined, rootset?: string) {
  const name = rootset ? rootset : 'func_rootset'
  return `${name}.values[${index}]`
}

// a getter for objects.

export const getObjectProperty = 'get_obj_property'

// a getter/setter function for arrays
export function arrayElementGetter(t: StaticType | undefined, node: AST.Node) {
  if (t === Integer)
    return '(*gc_intarray_get('
  else if (t === Float)
    return '(*gc_floatarray_get('
  else if (t === Boolean)
    return '(*gc_bytearray_get('
  else
    return `(*gc_array_get(`
}

// makes an array object from elements
export function arrayFromElements(t: StaticType) {
  if (t === Integer)
    return 'gc_make_intarray('
  else if (t === Float)
    return 'gc_make_floatarray('
  else if (t === Boolean)
    return 'gc_make_bytearray('
  else if (t === Any)
    return 'gc_make_array(1, '
  else
    return 'gc_make_array(0, '
}

export function arrayFromSize(t: StaticType) {
  if (t === Integer)
    return 'gc_new_intarray('
  else if (t === Float)
    return 'gc_new_floatarray('
  else if (t === Boolean)
    return 'gc_new_bytearray('
  else if (t === Any)
    return 'gc_new_array(1, '
  else
    return 'gc_new_array(0, '
}

export function actualElementType(t: StaticType) {
  if (t === Integer)
    return Integer
  else if (t === Float)
    return Float
  else if (t === Boolean)
    return Boolean
  else
    return Any
}

export const runtimeTypeArray = 'array_object'
export const arrayMaker = 'gc_new_string'

export const functionMaker = 'gc_new_function'
export const functionPtr = 'fptr'
export const functionSignature = 'signature'
export const functionGet = 'gc_function_object_ptr'

export function functionBodyName(name: string) {
  return `fbody${name}`
}
