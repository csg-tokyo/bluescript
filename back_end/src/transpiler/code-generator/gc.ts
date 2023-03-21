import {FunctionType, StaticType} from "../types";


export const GCGlobalRootSetArray = "gc_global_root_set_array";
export const GCNewString = "gc_new_string";
export const GCNewArray = "gc_new_array";
export const GCArraySet = "gc_array_set"; // value_t gc_array_set(value_t obj, value_t index, value_t new_value)

// to value_t
export const IntToValue = "int_to_value";
export const FloatToValue = "float_to_value";
export const BoolToValue = "bool_to_value";

// from value_t
export const ValueToInt = "value_to_int";
export const ValueToFloat = "value_to_float";
export const ValueToBool = "value_to_bool";

// value_t
export const ValueNull = "VALUE_NULL";
export const ValueUndef = "VALUE_UNDEF";

export function gcNewArray(elementNum: number = 0):string {
  return `${GCNewArray}(${elementNum})`;
}

export function PrimitiveToValueString(staticType: StaticType):string| null {
  if (isValueT(staticType)) {
    return null;
  }
  switch (staticType) {
    case "integer":
      return IntToValue;
    case "float":
      return FloatToValue;
    case "boolean":
      return BoolToValue;
    default:
      return null;
  }
}

export function ValueToPrimitiveString(from: StaticType, to: StaticType):string | null {
  if (!isValueT(from) || isValueT(to))
    return null
  switch (to) {
    case "integer":
      return ValueToInt;
    case "float":
      return ValueToFloat;
    case "boolean":
      return ValueToBool;
    default:
      return null;
  }
}



export function isValueT(t: StaticType | undefined): boolean {
  const noValueT: any[] = ["integer", "float", "boolean", "void", "null"]
  return t !== undefined && !noValueT.includes(t) && !(t instanceof FunctionType);
}