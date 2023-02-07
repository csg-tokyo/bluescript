import AvailableType from "../../../../models/available-type";

export function wrapStringWithToValue(rowString: string, type: AvailableType|"value"): string {
  switch (type) {
    case "integer":
      return `int_to_value(${rowString})`;
    case "float":
      return `float_to_value(${rowString})`;
    case "boolean":
      return `bool_to_value(${rowString})`;
    case "value":
      return rowString;
    default:
      throw Error("Unknown type passed. type: " + type);
  }
}

export function wrapStringWithFromValue(rowString: string, type: AvailableType|"value") {
  switch (type) {
    case "integer":
      return `value_to_int(${rowString})`;
    case "float":
      return `value_to_float(${rowString})`;
    case "boolean":
      return `value_to_float(${rowString})`;
    case "value":
      return rowString;
    default:
      throw Error("Unknown type passed. type: " + type);
  }
}
