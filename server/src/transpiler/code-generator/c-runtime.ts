// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { ErrorLog } from '../utils'
import { Integer, Float, BooleanT, StringT, Void, Null, Any,
    ObjectType, objectType, FunctionType,
    StaticType, isPrimitiveType, typeToString, ArrayType, sameType, encodeType, isSubtype,
    ByteArrayClass, } from '../types'
import { InstanceType, ClassTable } from '../classes'

export const anyTypeInC = 'value_t'
export const funcTypeInC = 'value_t'
export const funcStructInC = 'struct func_body'

export const mainFunctionName = 'bluescript_main'
export const returnValueVariable = 'ret_value_'

export const uint32type = 'uint32_t'

export function funcTypeToCType(type: StaticType, name: string = '(*)'): string {
  if (type instanceof FunctionType) {
    let typename = typeToCType(type.returnType)
    typename += ` ${name}(value_t`
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
    case BooleanT:
      return 'int32_t'
    case Void:
      return 'void'
    case StringT:
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
  return new ErrorLog().push(`internal error: the current runtime cannot convert ${fromType} to ${toType}`, node)
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
      else if (from === BooleanT)
        return '('
      else if (from === Any)
        return 'safe_value_to_int('
      else
        break
    case Float:
      if (from === Integer || from === BooleanT)
        return '(float)('
      else if (from === Any)
        return 'safe_value_to_float('
      else
        break
    case BooleanT:
      if (from === Integer)
        return '('
      else if (from === Float)
        return '(int32_t)('
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
        case BooleanT:
          return 'bool_to_value('
        default:
          return '('
      }
    default:    // "to" is either String, Object, or Array
      if (from === Any || from instanceof ObjectType) {
        if (to === StringT)
          return 'safe_value_to_string('
        else if (to instanceof ObjectType) {
          if (to === objectType)
            return 'safe_value_to_object('
          else if (to instanceof ArrayType) {
            if (to.elementType === Integer)
              return 'safe_value_to_intarray('
            else if (to.elementType === Float)
              return 'safe_value_to_floatarray('
            else if (to.elementType === BooleanT)
              return 'safe_value_to_boolarray('
            else if (to.elementType === Any)
              return 'safe_value_to_anyarray('
            else
              break
              // cannot determine wether a given array
              // is an array of String or Any
          }
          else if (to instanceof InstanceType)
            if (isSubtype(from, to))
              return '('
            else {
              const info = classObjectNameInC(to.name())
              return `safe_value_to_value(&${info}, `
            }

          break
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

export function updateOperator(op: string, isPrefix: boolean) {
  if (op === '++')
    return isPrefix ? 'i' : 'p'
  else // op === '--'
    return isPrefix ? 'd' : 'q'
}

export function arithmeticOpForAny(op: string) {
  switch(op) {
    case '==':
      return 'any_eq'
    case '!=':
      return '!any_eq'
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
    case '%':
      return 'any_modulo'
    case '**':
      return 'any_power'
    case '+=':
      return 'any_add_assign'
    case '-=':
      return 'any_subtract_assign'
    case '*=':
      return 'any_multiply_assign'
    case '/=':
      return 'any_divide_assign'
    case '%=':
      return 'any_modulo_assign'
    case 'i':    // ++v
      return 'any_increment'
    case 'p':   // v++
      return 'any_post_increment'
    case 'd':   // --v
      return 'any_decrement'
    case 'q':   // v--
      return 'any_post_decrement'
    default:
      throw new Error(`bad operator ${op}`)
  }
}

export function power(type: StaticType | undefined) {
  if (type === Float)
    return '(float)double_power('
  else if (type === Integer)
    return '(int32_t)double_power('
  else
    throw new Error('bad operand types for **')
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
  if (n < 1)
    return ''
  else if (n == 1)
    return 'ROOT_SET_N(func_rootset,1,VALUE_UNDEF)'
  else if (n == 2)
    return 'ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)'
  else if (n == 3)
    return 'ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)'
  else
    return `ROOT_SET(func_rootset,${n})`
}

export function declareRootSet(name: string, n: number) {
  return `ROOT_SET_DECL(${name}, ${n});`
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
export const setObjectProperty = 'set_obj_property'
export const setAnyObjectProperty = 'set_anyobj_property'
export const accmulateInUnknownMember = 'acc_anyobj_property'
export const getObjectPropertyAddress = 'get_obj_property_addr'

export const setGlobalVariable = 'set_global_variable'

export function getAnyObjectProperty(name: string) {
  if (name === ArrayType.lengthMethod)
    return 'get_anyobj_length_property'
  else
    return 'get_anyobj_property'
}

export function getObjectPrimitiveProperty(t: StaticType) {
  if (t === Float)
    return '*get_obj_float_property('
  else
    return '*get_obj_int_property('
}

export function makeBoxedValue(type: StaticType, value?: string) {
  if (isPrimitiveType(type))
    if (type === Float)
      return `gc_new_float_box(${value || 0})`
    else
      return `gc_new_int_box(${value || 0})`
  else
    return  `gc_new_box(${value || 'VALUE_UNDEF'})`
}

// a getter/setter function for arrays
export function arrayElementGetter(t: StaticType | undefined, arrayType: StaticType | undefined, node: AST.Node) {
  if (arrayType instanceof InstanceType && arrayType.name() === ByteArrayClass)
    return `(*gc_bytearray_get(`
  else if (arrayType === Any)
    return '(gc_safe_array_get('
  else if (t === Integer)
    return '(*gc_intarray_get('
  else if (t === Float)
    return '(*gc_floatarray_get('
  else if (t === BooleanT)
    return '(*gc_bytearray_get('
  else
    return `(*gc_array_get(`
}

export function arrayElementSetter(arrayType: StaticType | undefined) {
  if (arrayType === undefined)
    throw new Error('unknown array type')
  else if (arrayType === Any)
    return 'gc_safe_array_set('
  else
    return `gc_array_set(`
}

export const accumulateInUnknownArray = 'gc_safe_array_acc'

// makes an array object from elements
export function arrayFromElements(t: StaticType) {
  if (t === Integer)
    return 'gc_make_intarray('
  else if (t === Float)
    return 'gc_make_floatarray('
  else if (t === BooleanT)
    return 'gc_make_bytearray(true, '
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
  else if (t === BooleanT)
    return 'gc_new_bytearray(true, '
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
  else if (t === BooleanT)
    return BooleanT
  else
    return Any
}

export function getArrayLengthIndex(t: StaticType) {
  if (t === BooleanT)
    return 1
  else
    return 0
}

export const runtimeTypeArray = 'array_object'

export const stringMaker = 'gc_new_string'
export const isStringType = 'gc_is_string_object('

export const functionMaker = 'gc_new_function'
export const functionPtr = 'fptr'
export const functionSignature = 'signature'
export const functionGet = 'gc_function_object_ptr'
export const functionGetCapturedValue = 'gc_function_captured_value'

export function functionBodyName(name: string) {
  return `fbody${name}`
}

export function classNameInC(name: string) {
  return `class_${name}`
}

function propertyListNameInC(name: string) {
  return `plist_${name}`
}

export function classObjectNameInC(name: string) {
  return `class_${name}.clazz`
}

export function constructorNameInC(name: string) {
  return `new_${name}`
}

export function constructorBodyNameInC(name: string) {
  return `cons_${name}`
}

export function methodBodyNameInC(className: string, index: number) {
  return `mth_${index}_${className}`
}

export function externClassDef(clazz: ObjectType) {
  if (clazz) {
    if (clazz === objectType)
      return 'extern CLASS_OBJECT(object_class, 1);'
    else
      return `extern CLASS_OBJECT(${classNameInC(clazz.name())}, 1);`
  }
  else
    return ''
}

export function externNew(clazz: InstanceType) {
  const ftype = clazz.findConstructor()
  let signature: string = ' extern value_t '
  signature += constructorNameInC(clazz.name())
  signature += '(value_t'
  if (ftype) {
    for (const param of ftype.paramTypes) {
      signature += ', '
      signature += typeToCType(param)
    }
  }

  return signature + ');\n'
}

export function classDeclaration(clazz: InstanceType, classTable: ClassTable) {
  const name = clazz.name()
  const superClass = clazz.superclass()
  let superAddr: string
  if (superClass === objectType)
    superAddr = '&object_class.clazz'
  else
    superAddr = `&${classObjectNameInC(superClass.name())}`

  const table = clazz.makeMethodTable()
  let tableArray = ''
  for (let i = 0; i < table.length; i++)
    tableArray += `${methodBodyNameInC(table[i].clazz.name(), i)}, `

  const size = clazz.objectSize()
  const start = clazz.unboxedProperties() || 0

  const ptable = classTable.propertyTable(clazz)
  const propListName = propertyListNameInC(name)
  const propTable = `{ .size = ${ptable.props.length}, .offset = ${ptable.offset},
    .unboxed = ${ptable.unboxed}, .prop_names = ${propListName}, .unboxed_types = "${ptable.unboxedTypes}" }`

  const propList = `static const uint16_t ${propListName}[] = { ${ptable.props.join(', ')} };`

  return `${propList}\nCLASS_OBJECT(${classNameInC(name)}, ${table.length}) = {
    .body = { .s = ${size}, .i = ${start}, .cn = "${name}", .sc = ${superAddr} , .pt = ${propTable}, .vtbl = { ${tableArray} }}};`
}

export function makeInstance(clazz: InstanceType) {
  const name = clazz.name()
  if (name === ByteArrayClass)
    return 'gc_new_bytearray(false'
  else
    return `${constructorNameInC(name)}(gc_new_object(&${classObjectNameInC(name)})`
}

export function methodLookup(method: [StaticType, number, InstanceType], func: string) {
  return `((${funcTypeToCType(method[0])})method_lookup(${func}, ${method[1]}))`
}

export function isInstanceOf(t: InstanceType) {
  return `gc_is_instance_of(&${classObjectNameInC(t.name())}, `
}
