import {
  FunctionDeclaration, Identifier,
  isIdentifier, isNoop, Pattern,
  RestElement, TSTypeAnnotation,
  TypeAnnotation,
  VariableDeclaration,
  VariableDeclarator
} from "@babel/types";
import BlockEnv, {FuncBlockEnv} from "../env";
import getType from "./common/get-type";
import generateCString from "../generate-c-string";
import {wrapStringWithToValue} from "./common/wrap-string";
import getTypeAnnotationType from "./common/get-type-annotation-type";
import AvailableType from "../../../models/available-type";


export function handleVariableDeclaration(node: VariableDeclaration, env: BlockEnv): string {
  const kind = node.kind === "const" ? "const " : "";
  if (node.declarations.length > 2) {
    throw Error("This grammar is node allowed. The node: " + JSON.stringify(node));
  }
  let cString: string = env instanceof FuncBlockEnv ? "" : "volatile static "; // TODO: 深さが1、つまり大域変数だったらにしたい。
  cString += kind;
  cString += generateCString(node.declarations[0], env);
  return cString;
}


export function handleVariableDeclarator(node: VariableDeclarator, env: BlockEnv): string {
  if (!isIdentifier(node.id)) {
    throw Error("Unknown grammar. The node: " + JSON.stringify(node));
  }
  if (!node.id.typeAnnotation) {
    throw Error("There is no type. The node: " + JSON.stringify(node));
  }
  const variableType = getTypeAnnotationType(node.id.typeAnnotation)
  let cString: string = "";
  cString += generateCString(node.id.typeAnnotation, env);
  cString += " ";
  cString += generateCString(node.id, env);
  if (node.init) {
    if (getType(node.init, env) !== variableType) {
      // TODO: floatにintegerを入れた場合はokにしたい。
      throw Error("The init type does not match declaration type" + JSON.stringify(node));
    }
    // if (env instanceof FuncBlockEnv) { // 関数内だったら普通に初期化して大丈夫。
      cString += " = "
      cString += wrapStringWithToValue(generateCString(node.init, env), variableType);
    // } else {// 大域変数だったら、初期化は切り離す(?)
    //   cString += ";\n";
    //   cString += `void ${generateRandomFunctionName()}() { ${generateCString(node.id, env)} = ${wrapStringWithToValue(generateCString(node.init, env), variableType)}; }\n`;
    // }
  }

  env.addVariable(generateCString(node.id, env), variableType);
  return cString;
}

export default function handleFunctionDeclaration(node: FunctionDeclaration, env: BlockEnv) {
  if (!node.id) {
    throw Error("There is no function name.")
  }
  if (!node.returnType || isNoop(node.returnType)) {
    throw Error("Function return type should be written. function name: " + node.id.name);
  }

  const newEnv = new FuncBlockEnv(env);
  const paramsForOldEnv: {name: string, type: AvailableType}[] = [];
  node.params.forEach(param => {
    if (!isIdentifier(param) || !param.typeAnnotation) {
      throw Error("Unknown param type.");
    }
    paramsForOldEnv.push({name: param.name, type: getTypeAnnotationType(param.typeAnnotation)});
    newEnv.addVariable(param.name, getTypeAnnotationType(param.typeAnnotation));
  });
  env.addFunction(node.id.name, paramsForOldEnv, getTypeAnnotationType(node.returnType));

  let cString = getFunctionPrototype(node.id.name, node.returnType, node.params, env);
  cString += generateCString(node.body, newEnv);
  return cString;
}

// Mark: Functions used in handleFunctionDeclaration.

// 引数多すぎ。他にもっと良い方法があるはず。
function getFunctionPrototype(
  funcName: string,
  returnType: TSTypeAnnotation|TypeAnnotation,
  params:(Identifier | Pattern | RestElement)[],
  env: BlockEnv
) {
  let cString:string = "";
  cString += `${generateCString(returnType, env)} ${funcName}(`;
  if (params.length !== 0) {
    params.forEach(param=>{
      if (!isIdentifier(param) || !param.typeAnnotation) {
        throw Error("Unknown param type. function name: " + funcName)
      }
      cString += `${generateCString(param.typeAnnotation, env)} ${param.name}, `
    })
    cString = cString.slice(0, -2); // paramの最後の「, 」をとる。
  }
  cString += ") ";
  return cString;
}