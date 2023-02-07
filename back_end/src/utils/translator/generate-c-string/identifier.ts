import {Identifier} from "@babel/types";
import BlockEnv, {FuncBlockEnv} from "../env";

export function handleIdentifier(node: Identifier, env: BlockEnv): string {
  if (!(env instanceof FuncBlockEnv)) {
    return node.name;
  }
  // 関数の中に入っていて、Block内で既出の変数であればroot_set[?]に変換する。
  const variableName = node.name;
  const variableIndex = env.getVariableIndex(variableName);
  if (variableIndex === -1) {
    return node.name;
  }
  return `root_set.values[${variableIndex}]`;
}
