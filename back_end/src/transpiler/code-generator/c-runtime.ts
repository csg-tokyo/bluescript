import { Integer, Float, Boolean, String, Void, Null, Any,
    ObjectType, FunctionType,
    StaticType, isPrimitiveType, } from '../types'


export const mainFunctionName = 'bluescript_main'
export const returnValueVariable = 'ret_value_'

export function typeToCType(type: StaticType):string {
  if (type instanceof ObjectType)
    return 'value_t';
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
      return 'value_t'
    default:
      throw new Error(`${type} has not been supported yet.`)
  }
}

export function typeConversion(from: StaticType | undefined, to: StaticType | undefined) {
  let fname
  switch (to) {
    case Integer:
      if (from === Float)
        return '(int32_t)'
      else
        fname = 'safe_value_to_int'
      break
    case Float:
      if (from === Integer)
        return '(float)'
      else
        fname = 'safe_value_to_float'
      break
    case Boolean:
      fname = 'safe_value_to_bool'
      break
    case Void:
      throw new Error('cannot convert void to other types')
    default:
      switch (from) {
        case Integer:
          return 'int_to_value'
        case Float:
          return 'float_to_value'
        case Boolean:
          return 'bool_to_value'
        case Void:
          throw new Error('cannot convert void to other types')
        default:
          return ''
      }
  }

  if (from !== undefined && !isPrimitiveType(from))
    return fname
  else
    return ''
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

export const globalRootSetName = 'global_rootset'

export function makeRootSet(n: number) {
  return `ROOT_SET(func_rootset, ${n})`
}

export function declareRootSet(name: string, n: number) {
  return `ROOT_SET_DECL(${name}, ${n})`
}

export function initRootSet(name: string, n: number) {
  return `ROOT_SET_INIT(${name}, ${n})`
}

export const deleteRootSet = 'DELETE_ROOT_SET(func_rootset)'

export function rootSetVariable(index: number | undefined, rootset?: string) {
  const name = rootset ? rootset : 'func_rootset'
  return `${name}.values[${index}]`
}

// compute a nagative value of an any-type value
export const minusAnyValue = 'minus_any_value'

// a getter function for arrays
export const arrayElementGetter = 'gc_array_get'

// makes an array object from elements
export const arrayFromElements = 'gc_make_array'
