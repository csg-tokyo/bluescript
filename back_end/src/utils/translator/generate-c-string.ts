import {File, Node, Program} from "@babel/types";
import BlockEnv from "./env";
import handleFunctionDeclaration, {handleVariableDeclaration, handleVariableDeclarator} from "./generate-c-string/declaration";
import {
  handleBlockStatement,
  handleExpressionStatement, handleIfStatement,
  handleReturnStatement,
  handleWhileStatement
} from "./generate-c-string/statement";
import {handleAssignmentExpression, handleBinaryExpression, handleCallExpression} from "./generate-c-string/expression";
import {
  handleTSNumberKeyword,
  handleTSTypeAnnotation,
  handleTSTypeReference,
  handleTSVoidKeyword
} from "./generate-c-string/ts-types";
import {handleNumericLiteral} from "./generate-c-string/literal";
import {handleIdentifier} from "./generate-c-string/identifier";

// See https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md for Node type details.


export default function generateCString(node: Node, env: BlockEnv): string {
  switch (node.type) {
    case "File":
      return handleFile(node, env);
    case "Program":
      return handleProgram(node, env);
    // Statement
    case "WhileStatement":
      return handleWhileStatement(node, env);
    case "IfStatement":
      return handleIfStatement(node, env);
    case "ExpressionStatement":
      return handleExpressionStatement(node, env);
    case "BlockStatement":
      return handleBlockStatement(node, env);
    case "ReturnStatement":
      return handleReturnStatement(node, env);
    case "EmptyStatement":
      return "";
    case "BreakStatement":
      return "break"
    // Declaration
    case "VariableDeclaration":
      return handleVariableDeclaration(node, env);
    case "VariableDeclarator":
      return handleVariableDeclarator(node, env);
    case "FunctionDeclaration":
      return handleFunctionDeclaration(node, env);
    // Expression
    case "BinaryExpression":
      return handleBinaryExpression(node, env);
    case "AssignmentExpression":
      return handleAssignmentExpression(node, env);
    case "CallExpression":
      return handleCallExpression(node, env);
    // TS Type
    case "TSTypeAnnotation":
      return handleTSTypeAnnotation(node, env);
    case "TSTypeReference":
      return handleTSTypeReference(node, env)
    case "TSNumberKeyword":
      return handleTSNumberKeyword(node, env);
    case "TSVoidKeyword":
      return handleTSVoidKeyword(node, env);
    // Literal
    case "NumericLiteral":
      return handleNumericLiteral(node, env);
    // Identifier
    case "Identifier":
      return handleIdentifier(node, env);
    default:
      throw Error("Unknown node was passed. The passed node is " + JSON.stringify(node));
  }
}

function handleFile(node: File, env: BlockEnv): string {
  return generateCString(node.program, env);
}

function handleProgram(node: Program, env: BlockEnv): string {
  let cString: string = "";
  node.body.forEach(statement => {
    cString += generateCString(statement, env);
    cString += ";\n";
  })
  return cString;
}