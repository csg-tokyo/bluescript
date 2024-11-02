import {
  booleanLiteral,
  identifier,
  isFunctionDeclaration,
  tsAnyKeyword,
  tsArrayType, tsBooleanKeyword,
  tsTypeAnnotation,
  tsTypeReference, tsVoidKeyword
} from "@babel/types";
import {Any, ArrayType, BooleanT, Float, Integer, StaticType, Void} from "../transpiler/types";
import * as AST from '@babel/types'
import traverse from "@babel/traverse";

export const specializedFuncPrefix = "0";

// TODO: return type のために、全ての型に対応する
function type2Node(type: StaticType) {
  if (type === Integer || type === Float)
    return tsTypeAnnotation(tsTypeReference(identifier(type)));

  if (type === Void)
    return tsTypeAnnotation(tsVoidKeyword());

  if (type instanceof ArrayType && (type.elementType === Integer || type.elementType === Float))
    return tsTypeAnnotation(tsArrayType(tsTypeReference(identifier(type.elementType))))

  if (type instanceof ArrayType && type.elementType === BooleanT)
    return tsTypeAnnotation(tsArrayType(tsBooleanKeyword()))

  return tsTypeAnnotation(tsAnyKeyword());
}


export function convertAst(ast: AST.Node, funcName: string, paramTypes: StaticType[], returnType: StaticType) {
  traverse(ast, {
    Program: (path) => {
      const originalFunc = path.node.body[0]
      if(isFunctionDeclaration(originalFunc)   && originalFunc.id?.name === funcName) {
        const clone = structuredClone(originalFunc)
        if (clone.id === null || clone.id === undefined)
          return
        clone.id.name = specializedFuncPrefix + funcName
        clone.params.forEach((p, i) => {
          p.typeAnnotation = type2Node(paramTypes[i])
        })
        clone.returnType = type2Node(returnType);
        path.node.body.unshift(clone)
      }
    }
  })
}

