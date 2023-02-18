import { Identifier, Node } from "@babel/types"
import * as AST from '@babel/types';
import * as visitor from '../visitor'
import * as typechecker from "../type-checker/typechecker"
import {ErrorLog} from "../utils";
import {getNameTable} from "../type-checker/typechecker";

type Environment = visitor.Environment

// GC function, object names
export const GlobalNameTable = "global_name_table_array";
export const GCNewString = "gc_new_string";
export const GCArraySet = "gc_array_set";


export interface RootSet extends Environment {
  generateValueSettingString(variableName: string):string;
}

export class GlobalRootSet implements RootSet {
  globalRootSetIndex:number;

  constructor(globalRootSetIndex: number = 0) {
    this.globalRootSetIndex = globalRootSetIndex;
  }

  generateValueSettingString(variableName: string):string {
    // value_t gc_array_set(value_t obj, value_t index, value_t new_value)
    const s = `${GCArraySet}(${GlobalNameTable}, int_to_value(${this.globalRootSetIndex}), ${variableName})`;
    this.globalRootSetIndex++;
    return s;
  }
}

// TODO: BlockRootSet なるものが必要？

export function staticTypeToCType(staticType: typechecker.StaticType | undefined):string {
  switch (staticType) {
    case "integer":
      return "int32_t";
    case "float":
      return "float";
    case "boolean":
      return "bool";
    case "string":
      return "value_t"
    default:
      throw Error(`${staticType} has not been supported yet.`);
  }
}

export class CodeGenerator extends visitor.NodeVisitor {
  result: string = ""
  errorLog = new ErrorLog()
  nameTable?: typechecker.NameTable

  file(node: AST.File, env: Environment): void {
    visitor.file(node, env, this)
  }

  program(node: AST.Program, env: Environment): void {
    this.nameTable = typechecker.getNameTable(node)
    for (const child of node.body) {
      this.visit(child, env);
      this.result += ";\n";
    }
    this.result += "\n";
  }

  nullLiteral(node: AST.NullLiteral, env: Environment): void {
    this.result += "NULL";
  }

  stringLiteral(node: AST.StringLiteral, env: Environment): void {
    this.result += `"${node.value}"`
  }

  booleanLiteral(node: AST.BooleanLiteral, env: Environment): void {
    this.result += node.value ? "true" : "false";
  }

  numericLiteral(node: AST.NumericLiteral, env: Environment): void {
    this.result += String(node.value)
  }

  identifier(node: AST.Identifier, env: Environment): void {
    this.result += node.name;
  }

  whileStatement(node: AST.WhileStatement, env: Environment): void {
    this.result += "while (";
    this.visit(node.test, env);
    this.result += ") ";
    this.visit(node.body, env);
  }

  ifStatement(node: AST.IfStatement, env: Environment): void {
    this.result += "if (";
    this.visit(node.test, env);
    this.result += ") ";
    this.visit(node.consequent, env);

    if (node.alternate) {
      this.result += " else ";
      this.visit(node.alternate, env);
    }
  }

  forStatement(node: AST.ForStatement, env: Environment): void {
    this.result += "for (";

    if (node.init)
      this.visit(node.init, env)
    this.result += "; "

    if (node.test)
      this.visit(node.test, env)
    this.result += "; "

    if (node.update)
      this.visit(node.update, env)
    this.result += ";"

    this.result += ") ";
    this.visit(node.body, env)
  }

  expressionStatement(node: AST.ExpressionStatement, env: Environment): void {
    this.visit(node.expression, env)
  }

  blockStatement(node: AST.BlockStatement, env: Environment): void {
    this.nameTable = getNameTable(node)
    this.result += "{\n";
    for (const child of node.body){
      this.visit(child, env);
      this.result += ";\n";
    }
    this.result += "}";
  }

  returnStatement(node: AST.ReturnStatement, env: Environment): void {
    this.result += "return ";
    if (node.argument)
      this.visit(node.argument, env);
  }

  emptyStatement(node: AST.EmptyStatement, env: Environment): void {
    return
  }

  breakStatement(node: AST.BreakStatement, env: Environment): void {
    this.result += "break"
  }

  continueStatement(node: AST.ContinueStatement, env: Environment): void {
    this.result += "continue"
  }

  variableDeclaration(node: AST.VariableDeclaration, env: Environment): void {
    let kindString = "";
    if (node.kind === "const")
      kindString += "const ";
    for (const decl of node.declarations) {
      this.result += kindString;
      this.visit(decl, env);
      this.result += ";\n";
    }
  this.result = this.result.slice(0, -2);
  }

  variableDeclarator(node: AST.VariableDeclarator, env: Environment): void {
    const varName = (node.id as Identifier).name
    const varType = this.nameTable?.lookup(varName)?.type;
    this.result += staticTypeToCType(varType) + " ";
    this.result += varName;
    if (node.init) {
      if (varType === "string") {
        this.result += ` = ${GCNewString}(`;
        this.visit(node.init, env);
        this.result += ");\n";
        this.result += (env as GlobalRootSet).generateValueSettingString(varName);
      } else {
        this.result += " = ";
        this.visit(node.init, env);
      }
    }
  }

  functionDeclaration(node: AST.FunctionDeclaration, env: Environment): void {
    return
  }

  unaryExpression(node: AST.UnaryExpression, env: Environment): void {
    this.result += node.operator;
    this.visit(node.argument, env);
  }

  updateExpression(node: AST.UpdateExpression, env: Environment): void {
    if (node.prefix) {
      this.result += node.operator;
      this.visit(node.argument, env);
    } else {
      this.visit(node.argument, env);
      this.result += node.operator;
    }
  }

  binaryExpression(node: AST.BinaryExpression, env: Environment): void {
    if (node.extra?.parenthesized)
      this.result += "( "
    this.visit(node.left, env);
    this.result += ` ${node.operator} `;
    this.visit(node.right, env);
    if (node.extra?.parenthesized)
      this.result += " )"
  }

  assignmentExpression(node: AST.AssignmentExpression, env: Environment): void {
    // TODO: integer, float以外の代入に対応。
    this.visit(node.left, env);
    if (["=", "+=", "-=", "*=", "/=", "%=", "|=", "^=", "&=", "<<=", ">>="].includes(node.operator))
      this.result += ` ${node.operator} `;
    else
      this.assert(false, `${node.operator} has not been supported yet.`, node)
    this.visit(node.right, env);
  }

  logicalExpression(node: AST.LogicalExpression, env: Environment): void {
    if (node.extra?.parenthesized)
      this.result += "( ";
    this.visit(node.left, env);
    this.result += ` ${node.operator} `;
    this.visit(node.right, env);
    if (node.extra?.parenthesized)
      this.result += " )";
  }

  conditionalExpression(node: AST.ConditionalExpression, env: Environment): void {
    if (node.extra?.parenthesized)
      this.result += "( ";
    this.visit(node.test, env);
    this.result += " ? ";
    this.visit(node.consequent, env);
    this.result += " : ";
    this.visit(node.alternate, env);
    if (node.extra?.parenthesized)
      this.result += " )";
  }

  callExpression(node: AST.CallExpression, env: Environment): void {
    this.visit(node.callee, env);
    this.result += "(";
    for (const argument of node.arguments) {
      this.visit(argument, env);
      this.result += ", ";
    }
    if (node.arguments.length > 0)
      this.result = this.result.slice(0, -2);
    this.result += ")";
  }

  arrayExpression(node: AST.ArrayExpression, env: Environment):void {
    return
  }

  tsTypeAnnotation(node: AST.TSTypeAnnotation, env: Environment): void {
    this.visit(node.typeAnnotation, env)
  }

  tsTypeReference(node: AST.TSTypeReference, env: Environment): void {
    return
  }

  tsNumberKeyword(node: AST.TSNumberKeyword, env: Environment): void {
    return
  }

  tsVoidKeyword(node: AST.TSVoidKeyword, env: Environment): void {
    return
  }

  tsBooleanKeyword(node: AST.TSBooleanKeyword, env: Environment): void {
    return
  }

  tsStringKeyword(node: AST.TSStringKeyword, env: Environment): void {
    return
  }

  tsObjectKeyword(node: AST.TSObjectKeyword, env: Environment): void {
    return
  }

  tsAnyKeyword(node: AST.TSAnyKeyword, env: Environment): void {
    return
  }

  tsNullKeyword(node: AST.TSNullKeyword, env: Environment): void {
    return
  }

  tsUndefinedKeyword(node: AST.TSUndefinedKeyword, env: Environment): void {
    return
  }

  tsArrayType(node: AST.TSArrayType, env: Environment) {
    return
  }

  assert(test: boolean, msg: string, node: Node) {
    if (!test)
      this.errorLog.push(msg, node)

    return test
  }
}
