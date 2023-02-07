import {AssignmentExpression, BinaryExpression, CallExpression, isIdentifier} from "@babel/types";
import BlockEnv from "../env";
import getType from "./common/get-type";
import generateCString from "../generate-c-string";
import {wrapStringWithFromValue, wrapStringWithToValue} from "./common/wrap-string";
import getOriginalType from "./common/get-original-type";


export function handleBinaryExpression(node: BinaryExpression, env: BlockEnv): string {
  const leftString = generateCString(node.left, env);
  const rightString = generateCString(node.right, env);

  let cString: string = "";
  cString += getType(node.left, env) === "value"
    ? wrapStringWithFromValue(leftString, getOriginalType(node.left, env))
    : leftString;
  cString += " ";
  cString += node.operator === "===" ? "==" : node.operator;
  cString += " ";
  cString += getType(node.right, env) === "value"
    ? wrapStringWithFromValue(rightString, getOriginalType(node.right, env))
    : rightString;
  if (node.extra?.parenthesized) {
    return `(${cString})`
  }
  return cString;
}


export function handleAssignmentExpression(node: AssignmentExpression, env: BlockEnv) {
  if (node.operator !== "=") {
    throw Error("Unknown operator exists. The operator is " + node.operator);
  }
  const rightString = generateCString(node.right, env);
  const rightType = getType(node.right, env);
  let cString: string = "";
  cString += generateCString(node.left, env);
  cString += " ";
  cString += node.operator;
  cString += " ";
  cString += rightType !== "value"
    ? wrapStringWithToValue(rightString, rightType)
    : rightString;
  return cString;
}

export function handleCallExpression(node: CallExpression, env: BlockEnv) {
  if (!isIdentifier(node.callee)) {
    throw Error("Unsupported function call.");
  }
  const functionName = node.callee.name;
  const functionArgs = env.getFunction(functionName).params;

  let cString: string = "";
  cString += functionName;
  cString += "(";
  if (functionArgs.length !== node.arguments.length) {
    throw Error("The arguments length does not match definition.")
  }

  if (node.arguments.length !== 0) {
    node.arguments.forEach((argument, id) => {
      const argString = generateCString(argument, env);
      const argType = getType(argument, env);
      if (argType !== "value") {
        // TODO: Check argument type.
        cString += wrapStringWithToValue(argString, functionArgs[id].type);
      } else {
        if (getOriginalType(argument, env) !== functionArgs[id].type) {
          throw Error("An argument type does not match definition.");
        }
        cString += argString;
      }
      cString += ", "
    });
    cString = cString.slice(0, -2);
  }

  cString += ")";
  return cString;
}