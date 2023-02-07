import {Identifier, Node} from "@babel/types";
import BlockEnv from "../../env";
import AvailableType from "../../../../models/available-type";

export default function getOriginalType(node: Node, env:BlockEnv): AvailableType {
  if (node.type !== "Identifier") {
    throw Error("Unexpected node was passed. Node: " + node.type);
  }
  const entry = env.getSymbol(node.name);
  if (entry.symbolType === "function") {
    return entry.returnType;
  } else {
    return entry.variableType;
  }
}