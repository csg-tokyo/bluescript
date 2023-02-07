import {
  BlockStatement,
  ExpressionStatement, IfStatement, isBlockStatement, isIdentifier,
  isReturnStatement,
  isVariableDeclaration,
  ReturnStatement, VariableDeclaration, WhileStatement
} from "@babel/types";
import BlockEnv, {FuncBlockEnv} from "../env";
import generateCString from "../generate-c-string";
import {wrapStringWithFromValue, wrapStringWithToValue} from "./common/wrap-string";
import getType from "./common/get-type";
import getOriginalType from "./common/get-original-type";
import AvailableType from "../../../models/available-type";

export function handleWhileStatement(node: WhileStatement, env: BlockEnv): string {
  let cString:string = "";
  const testType = getType(node.test, env);
  if (testType === "value") {
    cString += `while (${wrapStringWithFromValue(generateCString(node.test, env), getOriginalType(node.test, env))}) `;
  } else {
    cString += `while (${generateCString(node.test, env)}) `;
  }

  if (isBlockStatement(node.body)) {
    const newBlockEnv = new BlockEnv(env);
    cString += generateCString(node.body, newBlockEnv);
  } else {
    cString += generateCString(node.body, env);
  }
  return cString;
}

export function handleIfStatement(node: IfStatement, env: BlockEnv) {
  let cString:string = "";
  const testType = getType(node.test, env);
  cString += testType === "value"
    ? `if (${wrapStringWithFromValue(generateCString(node.test, env), getOriginalType(node.test, env))}) `
    : `if (${generateCString(node.test, env)}) `;

  if (isBlockStatement(node.consequent)) {
    const newBlockEnv = new BlockEnv(env);
    cString += generateCString(node.consequent, newBlockEnv);
  } else {
    cString += generateCString(node.consequent, env);
  }

  if (node.alternate) {
    cString += " else ";
    if (isBlockStatement(node.alternate)) {
      const newBlockEnv = new BlockEnv(env);
      cString += generateCString(node.alternate, newBlockEnv);
    } else {
      cString += generateCString(node.alternate, env);
    }
  }
  return cString;
}

export function handleExpressionStatement(node: ExpressionStatement, env: BlockEnv): string {
  return generateCString(node.expression, env);
}

export function handleReturnStatement(node: ReturnStatement, env: BlockEnv): string {
  let cString = "return";
  if (node.argument) {
    cString += ` ${wrapStringWithToValue(generateCString(node.argument, env), getType(node.argument, env))}`;
  }
  return cString;
}

export function handleBlockStatement(node: BlockStatement, env: BlockEnv): string {
  if (env instanceof FuncBlockEnv) {
    return handleFunctionBlockStatement(node, env);
  }
  return handleNotFunctionsBlockStatement(node, env);
}

// Mark: Functions for handleBlockStatement.
function handleNotFunctionsBlockStatement(node: BlockStatement, env: BlockEnv): string {
  let cString: string = "{\n";
  node.body.forEach(statement=>{
    cString += `${generateCString(statement, env)};\n`;
  });
  cString += "}";
  return cString;
}


function handleFunctionBlockStatement(node: BlockStatement, env: FuncBlockEnv): string {
  const params: {name: string, variableType: AvailableType}[] = env.getVariables();
  let numOfVariables = 0;
  let cString:string = "";

  params.forEach(param => {
    cString += `root_set.values[${numOfVariables}] = ${param.name};\n`
    numOfVariables += 1;
  });

  node.body.forEach(statement=>{
    if (isVariableDeclaration(statement)) {
      cString += `${generateCString(statement, env)};\n`;
      cString += `root_set.values[${numOfVariables}] = ${getVariableName(statement)};\n`;
      numOfVariables += 1;
    } else if (isReturnStatement(statement)) {
      cString += "DELETE_ROOT_SET(root_set);\n";
      cString += `${generateCString(statement, env)};\n`;
    } else {
      cString += `${generateCString(statement, env)};\n`;
    }
  });
  cString += "DELETE_ROOT_SET(root_set);\n"; // TODO: 気が向いたら綺麗にする。
  cString += "}";

  cString = `{\nROOT_SET(root_set, ${numOfVariables});\n` + cString; // 最初に足す。
  return cString;
}


export function getVariableName(node: VariableDeclaration) {
  if (node.declarations.length > 2) {
    throw Error("This grammar is node allowed. The node: " + JSON.stringify(node));
  }
  const declarator = node.declarations[0];
  if (!isIdentifier(declarator.id)) {
    throw Error("Unknown grammar.");
  }
  return declarator.id.name;
}
