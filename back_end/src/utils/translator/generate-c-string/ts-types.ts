import {TSNumberKeyword, TSTypeAnnotation, TSTypeReference, TSVoidKeyword} from "@babel/types";
import BlockEnv from "../env";
import generateCString from "../generate-c-string";

export function handleTSTypeAnnotation(node: TSTypeAnnotation, env: BlockEnv): string {
  return generateCString(node.typeAnnotation, env);
}

export function handleTSTypeReference(node: TSTypeReference, env: BlockEnv): string {
  return "value_t";
}

export function handleTSNumberKeyword(node: TSNumberKeyword, env: BlockEnv): string {
  return "value_t";
}

export function handleTSVoidKeyword(node: TSVoidKeyword, env: BlockEnv): string {
  return "void";
}
