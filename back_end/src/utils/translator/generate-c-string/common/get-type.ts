import {
  AssignmentExpression,
  BinaryExpression,
  Node,
  NumericLiteral,
} from "@babel/types";
import BlockEnv from "../../env";
import getOriginalType from "./get-original-type";
import AvailableType from "../../../../models/available-type";

export default function getType(node: Node, env: BlockEnv):AvailableType | "value" {
  switch (node.type) {
    // Expression
    case "BinaryExpression":
      return handleBinaryExpression(node, env);
    case "AssignmentExpression":
      return handleAssignmentExpression(node, env);
    case "CallExpression":
      return "value";
    // Literal
    case "NumericLiteral":
      return handleNumericLiteral(node, env);
    // Identifier
    case "Identifier":
      return "value";
    default:
      throw Error("Unknown node was passed. The passed node is " + JSON.stringify(node));
  }
}

function handleBinaryExpression(node: BinaryExpression, env: BlockEnv):AvailableType | "value" {
  const types = ["integer", "float"] // TODO: 全部のタイプに対応する。
  let rightType = getType(node.right, env);
  rightType = rightType === "value" ? getOriginalType(node.right, env) : rightType;
  let leftType = getType(node.left, env);
  leftType = leftType === "value" ? getOriginalType(node.left, env) : leftType;
  if (leftType === rightType) {
    return rightType;
  }
  if (!types.includes(leftType) || !types.includes(rightType)) {
    throw Error("Unknown type node: " + JSON.stringify(node));
  }
  return "float";
}

function handleAssignmentExpression(node: AssignmentExpression, env: BlockEnv): AvailableType | "value" {
  return getType(node.right, env)
}

function handleNumericLiteral(node: NumericLiteral, env: BlockEnv): AvailableType | "value" {
  return Number.isInteger(node.value) ? "integer" : "float";
}