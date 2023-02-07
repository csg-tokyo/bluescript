import {isIdentifier, Node, TSNumberKeyword, TSTypeAnnotation, TSTypeReference, TSVoidKeyword} from "@babel/types";
import AvailableType from "../../../../models/available-type";


export default function getTypeAnnotationType(node: Node): AvailableType {
  switch (node.type) {
    case "TSTypeAnnotation":
      return handleTSTypeAnnotation(node);
    case "TSTypeReference":
      return handleTSTypeReference(node);
    case "TSNumberKeyword":
      return handleTSNumberKeyword(node);
    case "TSVoidKeyword":
      return handleTSVoidKeyword(node);
    default:
      throw Error("Unknown node was passed. The passed node is " + JSON.stringify(node));
  }
}

function handleTSTypeAnnotation(node: TSTypeAnnotation): AvailableType {
  return getTypeAnnotationType(node.typeAnnotation);
}

function handleTSTypeReference(node: TSTypeReference): AvailableType {
  if (!isIdentifier(node.typeName)) {
    throw Error("Unknown type: " + JSON.stringify(node.type));
  }
  switch (node.typeName.name) {
    case "integer":
      return "integer";
    case "float":
      return "float";
    default:
      throw Error("Unknown type: " + node.typeName.name);
  }
}

function handleTSNumberKeyword(node: TSNumberKeyword): AvailableType {
  return "integer"
}

function handleTSVoidKeyword(node: TSVoidKeyword): AvailableType {
  return "void";
}