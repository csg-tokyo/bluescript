import TypeChecker from "../transpiler/type-checker";
import {NameInfo, NameTable, NameTableMaker} from "../transpiler/names";
import * as AST from "@babel/types";
import {getSpecializedNode} from "./utils";
import {Any} from "../transpiler/types";


export function jitTypecheck<Info extends NameInfo>(ast: AST.Node, maker: NameTableMaker<Info>, names: NameTable<Info>,
                                                 typeChecker: TypeChecker<Info>,
                                                 importer?: (file: string) => NameTable<Info>): NameTable<Info> {
  // importer reads a given source file and returns a name table.
  // If the source file is not found, importer throws an error message.  The type of the message must be string.
  // importer may also throw an ErrorLog object.
  typeChecker.firstPass = true
  typeChecker.result = Any
  typeChecker.visit(ast, names)
  if (typeChecker.errorLog.hasError())
    throw typeChecker.errorLog

  typeChecker.firstPass = false
  typeChecker.result = Any
  typeChecker.visit(ast, names)
  if (typeChecker.errorLog.hasError())
    throw typeChecker.errorLog

  return names
}

export class JitTypeChecker<Info extends NameInfo> extends TypeChecker<NameInfo> {
  functionDeclaration(node: AST.FunctionDeclaration, names: NameTable<Info>): void {
    super.functionDeclaration(node, names)
    const specializedNode = getSpecializedNode(node)
    if (specializedNode !== undefined)
      super.functionDeclaration(specializedNode, names)
  }
}