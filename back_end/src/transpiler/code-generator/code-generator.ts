import { Identifier, Node } from "@babel/types";
import * as AST from '@babel/types';
import * as visitor from "../visitor";
import {ErrorLog} from "../utils";
import {FunctionType, StaticType} from "../types";
import {BlockNameTable, FunctionNameTable, getNameTable, getStaticType} from "../type-checker/names";
import {BlockRootSet, FunctionRootSet, GCNewString, RootSet} from "./root-set";


export function staticTypeToCType(staticType: StaticType | undefined):string {
  switch (staticType) {
    case "integer":
      return "int32_t";
    case "float":
      return "float";
    case "boolean":
      return "bool";
    case "string":
      return "value_t"
    case "void":
      return "void"
    default:
      throw Error(`${staticType} has not been supported yet.`);
  }
}

export class CodeGenerator extends visitor.NodeVisitor {
  result: string = ""
  errorLog = new ErrorLog()

  file(node: AST.File, env: RootSet): void {
    visitor.file(node, env, this)
  }

  program(node: AST.Program, env: RootSet): void {
    for (const child of node.body) {
      this.visit(child, env);
      this.result += ";\n";
    }
    this.result += "\n";
  }

  nullLiteral(node: AST.NullLiteral, env: RootSet): void {
    this.result += "NULL";
  }

  stringLiteral(node: AST.StringLiteral, env: RootSet): void {
    this.result += `"${node.value}"`
  }

  booleanLiteral(node: AST.BooleanLiteral, env: RootSet): void {
    this.result += node.value ? "true" : "false";
  }

  numericLiteral(node: AST.NumericLiteral, env: RootSet): void {
    this.result += String(node.value)
  }

  identifier(node: AST.Identifier, env: RootSet): void {
    this.result += node.name;
  }

  whileStatement(node: AST.WhileStatement, env: RootSet): void {
    this.result += "while (";
    this.visit(node.test, env);
    this.result += ") ";
    this.visit(node.body, env);
  }

  ifStatement(node: AST.IfStatement, env: RootSet): void {
    this.result += "if (";
    this.visit(node.test, env);
    this.result += ") ";
    this.visit(node.consequent, env);

    if (node.alternate) {
      this.result += " else ";
      this.visit(node.alternate, env);
    }
  }

  forStatement(node: AST.ForStatement, env: RootSet): void {
    const blockNameTable = getNameTable(node) as BlockNameTable;
    const blockRootSet = new BlockRootSet(env, blockNameTable);
    this.result += "for (";

    if (node.init)
      this.visit(node.init, blockRootSet);
    this.result += "; "

    if (node.test)
      this.visit(node.test, blockRootSet);
    this.result += "; "

    if (node.update)
      this.visit(node.update, blockRootSet);
    this.result += ";"

    this.result += ") ";
    this.visit(node.body, blockRootSet
    );
  }

  expressionStatement(node: AST.ExpressionStatement, env: RootSet): void {
    this.visit(node.expression, env)
  }

  blockStatement(node: AST.BlockStatement, env: RootSet): void {
    const blockNameTable = getNameTable(node) as BlockNameTable;
    const blockRootSet = new BlockRootSet(env, blockNameTable)
    this.result += "{\n";
    this.result += blockRootSet.generateInitStatement();
    for (const child of node.body){
      this.visit(child, blockRootSet);
      this.result += ";\n";
    }
    this.result += blockRootSet.generateCleanUpStatement();
    this.result += "}";
  }

  returnStatement(node: AST.ReturnStatement, env: RootSet): void {
    this.result += (env as BlockRootSet).generateCleanUpStatement();
    this.result += "return ";
    if (node.argument)
      this.visit(node.argument, env);
  }

  emptyStatement(node: AST.EmptyStatement, env: RootSet): void {
    return
  }

  breakStatement(node: AST.BreakStatement, env: RootSet): void {
    this.result += "break"
  }

  continueStatement(node: AST.ContinueStatement, env: RootSet): void {
    this.result += "continue"
  }

  variableDeclaration(node: AST.VariableDeclaration, env: RootSet): void {
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

  variableDeclarator(node: AST.VariableDeclarator, env: RootSet): void {
    const varName = (node.id as Identifier).name
    const varType = env.nameTable.lookup(varName)?.type;
    this.result += staticTypeToCType(varType) + " ";
    this.result += varName;
    if (node.init) {
      if (AST.isStringLiteral(node.init)) {
        this.result += ` = ${GCNewString}(`;
        this.visit(node.init, env);
        this.result += ");\n";
      } else {
        this.result += " = ";
        this.visit(node.init, env);
      }
      this.result += env.generateSetStatement(varName);
    }
  }

  functionDeclaration(node: AST.FunctionDeclaration, env: RootSet): void {
    const funcName = (node.id as Identifier).name
    const funcType = getStaticType(node) as FunctionType;
    this.result += `${staticTypeToCType(funcType.returnType)} ${funcName}(`;
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      const paramName = (node.params[i] as Identifier).name;
      const paramType = funcType.paramTypes[i];
      this.result += `${staticTypeToCType(paramType)} ${paramName}, `;
    }
    if (node.params.length > 0)
      this.result = this.result.slice(0, -2);
    this.result += ") ";
    const funcNameTable = getNameTable(node) as FunctionNameTable;
    const funcRootSet = new FunctionRootSet(env, funcNameTable);
    this.visit(node.body, funcRootSet);
  }

  unaryExpression(node: AST.UnaryExpression, env: RootSet): void {
    this.result += node.operator;
    this.visit(node.argument, env);
  }

  updateExpression(node: AST.UpdateExpression, env: RootSet): void {
    if (node.prefix) {
      this.result += node.operator;
      this.visit(node.argument, env);
    } else {
      this.visit(node.argument, env);
      this.result += node.operator;
    }
  }

  binaryExpression(node: AST.BinaryExpression, env: RootSet): void {
    if (node.extra?.parenthesized)
      this.result += "( "
    this.visit(node.left, env);
    this.result += ` ${node.operator} `;
    this.visit(node.right, env);
    if (node.extra?.parenthesized)
      this.result += " )"
  }

  assignmentExpression(node: AST.AssignmentExpression, env: RootSet): void {
    this.visit(node.left, env);
    this.result += ` ${node.operator} `;
    if (AST.isStringLiteral(node.right)) {
      this.result += `${GCNewString}(`;
      this.visit(node.right, env);
      this.result += ");\n";
    } else {
      this.visit(node.right, env);
    }
    if (AST.isIdentifier(node.left))
      this.result += env.generateUpdateStatement(node.left.name);

  }

  logicalExpression(node: AST.LogicalExpression, env: RootSet): void {
    if (node.extra?.parenthesized)
      this.result += "( ";
    this.visit(node.left, env);
    this.result += ` ${node.operator} `;
    this.visit(node.right, env);
    if (node.extra?.parenthesized)
      this.result += " )";
  }

  conditionalExpression(node: AST.ConditionalExpression, env: RootSet): void {
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

  callExpression(node: AST.CallExpression, env: RootSet): void {
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

  arrayExpression(node: AST.ArrayExpression, env: RootSet):void {
    return
  }

  memberExpression(node: AST.MemberExpression, env: RootSet):void {
    return
  }

  tsAsExpression(node: AST.TSAsExpression, env: RootSet): void {
    return
  }

  tsTypeAnnotation(node: AST.TSTypeAnnotation, env: RootSet): void {
    this.visit(node.typeAnnotation, env)
  }

  tsTypeReference(node: AST.TSTypeReference, env: RootSet): void {
    return
  }

  tsNumberKeyword(node: AST.TSNumberKeyword, env: RootSet): void {
    return
  }

  tsVoidKeyword(node: AST.TSVoidKeyword, env: RootSet): void {
    return
  }

  tsBooleanKeyword(node: AST.TSBooleanKeyword, env: RootSet): void {
    return
  }

  tsStringKeyword(node: AST.TSStringKeyword, env: RootSet): void {
    return
  }

  tsObjectKeyword(node: AST.TSObjectKeyword, env: RootSet): void {
    return
  }

  tsAnyKeyword(node: AST.TSAnyKeyword, env: RootSet): void {
    return
  }

  tsNullKeyword(node: AST.TSNullKeyword, env: RootSet): void {
    return
  }

  tsUndefinedKeyword(node: AST.TSUndefinedKeyword, env: RootSet): void {
    return
  }

  tsArrayType(node: AST.TSArrayType, env: RootSet) {
    return
  }

  assert(test: boolean, msg: string, node: Node) {
    if (!test)
      this.errorLog.push(msg, node)

    return test
  }
}
