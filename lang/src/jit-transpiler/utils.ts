import {
  identifier,
  isFunctionDeclaration,
  tsAnyKeyword,
  tsArrayType, tsBooleanKeyword, tsFunctionType, tsStringKeyword,
  tsTypeAnnotation,
  tsTypeReference, tsVoidKeyword
} from "@babel/types";
import {Any, ArrayType, BooleanT, Float, FunctionType, Integer, StaticType, StringT, Void} from "../transpiler/types";
import * as AST from '@babel/types'
import traverse from "@babel/traverse";
import {Profiler} from "./profiler";
import {InstanceType} from "../transpiler/classes";
import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";

export const specializedFuncPrefix = "0";


export function typeStringToStaticType(typeString: string, gvnt: GlobalVariableNameTable):StaticType {
  if (typeString === 'integer' || typeString === 'float' || typeString === 'boolean' || typeString === 'string') {
    return typeString
  } else if (typeString === 'undefined') {
    return 'null'
  } else if (typeString === 'Array<any>') {
    return new ArrayType('any')
  } else if (typeString === 'Array<integer>') {
    return new ArrayType('integer')
  } else if (typeString === 'Array<float>') {
    return new ArrayType('float')
  } else if (typeString === 'Array<boolean>') {
    return new ArrayType('boolean')
  } else if (isArray(typeString)) {
    return getArrayType(typeString, gvnt)
  } else if (typeString === 'Function') {
    return 'any'
  } else {
    const type = gvnt === undefined ? undefined : gvnt.lookup(typeString)?.type
    if (type === undefined || !(type instanceof InstanceType))
      throw new ProfileError(`Cannot find the profiled class: ${typeString}`)
    return type
  }
}

function isArray(typeString: string) {
  return /\[\]$/.test(typeString)
}

function getArrayType(typeString: string, gvnt: GlobalVariableNameTable):StaticType {
  const matches = typeString.match(/(\[\])+$/);
  let ndim = matches ? matches[0].length / 2 : 0;
  const className = typeString.replace(/(\[\])+$/, "");
  let arr: StaticType|undefined;
  if (className === 'string')
      arr = 'string'
  else {
    arr = gvnt.lookup(className)?.type
    if (arr === undefined || !(arr instanceof InstanceType))
      throw new ProfileError(`Cannot find the profiled class: ${className}`)
  }

  while (ndim > 0) {
    arr = new ArrayType(arr)
    ndim -= 1
  }
  return arr
}

function staticTypeToTSType(type: StaticType): AST.TSType {
  if (type === Integer || type === Float)
    return tsTypeReference(identifier(type));

  if (type === BooleanT)
    return tsBooleanKeyword();

  if (type === Any)
    return tsAnyKeyword();

  if (type === StringT)
    return tsStringKeyword();

  if (type === Void)
    return tsVoidKeyword();

  if (type instanceof ArrayType)
    return tsArrayType(staticTypeToTSType(type.elementType));

  if (type instanceof FunctionType) {
    const paramNodes = type.paramTypes.map((p, i) => {
      const id = identifier(`p${i}`);
      id.typeAnnotation = staticTypeToNode(p);
      return id
    })
    return tsFunctionType(undefined, paramNodes, staticTypeToNode(type.returnType))
  }

  if (type instanceof InstanceType)
    return tsTypeReference(identifier(type.name()));

  return tsAnyKeyword();
}

function staticTypeToNode(type: StaticType):AST.TSTypeAnnotation {
  return tsTypeAnnotation(staticTypeToTSType(type));
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
          if (!AST.isVoidPattern(p)) {
            p.typeAnnotation = staticTypeToNode(specializedType.paramTypes[i])
          }
        })
        clone.returnType = staticTypeToNode(specializedType.returnType)
        addSpecializedNode(statement, clone)
      })
    }
  })
}


export class ProfileError extends Error {
  public constructor(message?: string) {
    super(`Profile Error: ${message}`);
  }
}

export class JITCompileError extends Error {
  public constructor(message?: string) {
    super(`JIT Compile Error: ${message}`);
  }
}
