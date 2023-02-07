import {NumericLiteral} from "@babel/types";
import BlockEnv from "../env";

export function handleNumericLiteral(node: NumericLiteral, env: BlockEnv): string {
  return String(node.value);
}
