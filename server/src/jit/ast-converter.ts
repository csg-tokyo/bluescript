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
import {Profiler} from "./profiler";

export const specializedFuncPrefix = "0";

// TODO: return type のために、全ての型に対応する
function type2Node(type: StaticType) {
  if (type === Integer || type === Float)
    return tsTypeAnnotation(tsTypeReference(identifier(type)));

  if (type === BooleanT)
    return tsTypeAnnotation(tsBooleanKeyword());

  if (type === Void)
    return tsTypeAnnotation(tsVoidKeyword());

  if (type instanceof ArrayType && (type.elementType === Integer || type.elementType === Float))
    return tsTypeAnnotation(tsArrayType(tsTypeReference(identifier(type.elementType))))

  if (type instanceof ArrayType && type.elementType === BooleanT)
    return tsTypeAnnotation(tsArrayType(tsBooleanKeyword()))

  return tsTypeAnnotation(tsAnyKeyword());
}

function addSpecializedNode(node: AST.FunctionDeclaration, specializedNode: AST.FunctionDeclaration) {
  ((node as unknown) as { specialized: AST.FunctionDeclaration }).specialized = specializedNode
}

export function getSpecializedNode(node: AST.FunctionDeclaration) {
  return ((node as unknown) as { specialized?: AST.FunctionDeclaration }).specialized
}


export function convertAst(ast: AST.Node, profiler: Profiler) {
  traverse(ast, {
    Program: (path) => {
      path.node.body.forEach(statement => {
        if (!isFunctionDeclaration(statement))
          return
        const name = statement.id?.name
        const profile = name ? profiler.getFunctionProfileByName(name) : undefined;
        if (profile === undefined || (profile.state.state !== 'specializing' && profile.state.state !== 'specialized'))
          return;
        const specializedType = profile.state.type
        const clone = structuredClone(statement)
        if (clone.id === null || clone.id === undefined)
          return;
        clone.id.name = specializedFuncPrefix + name
        clone.params.forEach((p, i) => {
          p.typeAnnotation = type2Node(specializedType.paramTypes[i])
        })
        clone.returnType = type2Node(specializedType.returnType)
        addSpecializedNode(statement, clone)
      })
    }
  })
}

