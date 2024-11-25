// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import AST, { Node, thisExpression } from "@babel/types"
import { ErrorLog } from "./utils"

// For the specifications of Node objects,
// see https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md

type VisitorHandler = <E>(visitor: NodeVisitor<E>, node: Node, env: E) => void

export abstract class NodeVisitor<Environment> {
    static handlers = new Map<string, VisitorHandler>([
        [ 'File', (visitor, node, env) => visitor.file(node as AST.File, env) ],
        [ 'Program', (visitor, node, env) => visitor.program(node as AST.Program, env) ],
        [ 'ImportDeclaration', (visitor, node, env) => visitor.importDeclaration(node as AST.ImportDeclaration, env) ],
        // Literal
        [ 'NullLiteral',  (visitor, node, env) => visitor.nullLiteral(node as AST.NullLiteral, env) ],
        [ 'StringLiteral',  (visitor, node, env) => visitor.stringLiteral(node as AST.StringLiteral, env) ],
        [ 'BooleanLiteral',  (visitor, node, env) => visitor.booleanLiteral(node as AST.BooleanLiteral, env) ],
        [ 'NumericLiteral', (visitor, node, env) => visitor.numericLiteral(node as AST.NumericLiteral, env) ],
        // Identifier
        [ 'Identifier', (visitor, node, env) => visitor.identifier(node as AST.Identifier, env) ],
        // Statement
        [ 'WhileStatement', (visitor, node, env) => visitor.whileStatement(node as AST.WhileStatement, env) ],
        [ 'IfStatement', (visitor, node, env) => visitor.ifStatement(node as AST.IfStatement, env) ],
        [ 'ForStatement', (visitor, node, env) => visitor.forStatement(node as AST.ForStatement, env) ],
        [ 'ExpressionStatement', (visitor, node, env) => visitor.expressionStatement(node as AST.ExpressionStatement, env) ],
        [ 'BlockStatement', (visitor, node, env) => visitor.blockStatement(node as AST.BlockStatement, env) ],
        [ 'ReturnStatement', (visitor, node, env) => visitor.returnStatement(node as AST.ReturnStatement, env) ],
        [ 'EmptyStatement', (visitor, node, env) => visitor.emptyStatement(node as AST.EmptyStatement, env) ],
        [ 'BreakStatement', (visitor, node, env) => visitor.breakStatement(node as AST.BreakStatement, env) ],
        [ 'ContinueStatement', (visitor, node, env) => visitor.continueStatement(node as AST.ContinueStatement, env) ],
        // Declaration
        [ 'ClassDeclaration', (visitor, node, env) => visitor.classDeclaration(node as AST.ClassDeclaration, env) ],
        [ 'ClassBody', (visitor, node, env) => visitor.classBody(node as AST.ClassBody, env) ],
        [ 'ClassProperty', (visitor, node, env) => visitor.classProperty(node as AST.ClassProperty, env) ],
        [ 'ClassMethod', (visitor, node, env) => visitor.classMethod(node as AST.ClassMethod, env) ],
        [ 'VariableDeclaration', (visitor, node, env) => visitor.variableDeclaration(node as AST.VariableDeclaration, env) ],
        [ 'VariableDeclarator', (visitor, node, env) => visitor.variableDeclarator(node as AST.VariableDeclarator, env) ],
        [ 'FunctionDeclaration', (visitor, node, env) => visitor.functionDeclaration(node as AST.FunctionDeclaration, env) ],
        // Expression
        [ 'ArrowFunctionExpression', (visitor, node, env) => visitor.arrowFunctionExpression(node as AST.ArrowFunctionExpression, env) ],
        [ 'UnaryExpression', (visitor, node, env) => visitor.unaryExpression(node as AST.UnaryExpression, env) ],
        [ 'UpdateExpression', (visitor, node, env) => visitor.updateExpression(node as AST.UpdateExpression, env) ],
        [ 'BinaryExpression', (visitor, node, env) => visitor.binaryExpression(node as AST.BinaryExpression, env) ],
        [ 'AssignmentExpression', (visitor, node, env) => visitor.assignmentExpression(node as AST.AssignmentExpression, env) ],
        [ 'LogicalExpression', (visitor, node, env) => visitor.logicalExpression(node as AST.LogicalExpression, env) ],
        [ 'ConditionalExpression', (visitor, node, env) => visitor.conditionalExpression(node as AST.ConditionalExpression, env) ],
        [ 'CallExpression', (visitor, node, env) => visitor.callExpression(node as AST.CallExpression, env) ],
        [ 'NewExpression', (visitor, node, env) => visitor.newExpression(node as AST.NewExpression, env) ],
        [ 'ThisExpression', (visitor, node, env) => visitor.thisExpression(node as AST.ThisExpression, env) ],
        [ 'Super', (visitor, node, env) => visitor.superExpression(node as AST.Super, env) ],
        [ 'ArrayExpression', (visitor, node, env) => visitor.arrayExpression(node as AST.ArrayExpression, env) ],
        [ 'MemberExpression', (visitor, node, env) => visitor.memberExpression(node as AST.MemberExpression, env) ],
        [ `TaggedTemplateExpression`,  (visitor, node, env) => visitor.taggedTemplateExpression(node as AST.TaggedTemplateExpression, env) ],
        // TS Type
        [ 'TSAsExpression',  (visitor, node, env) => visitor.tsAsExpression(node as AST.TSAsExpression, env)],
        [ 'TSTypeAnnotation', (visitor, node, env) => visitor.tsTypeAnnotation(node as AST.TSTypeAnnotation, env) ],
        [ 'TSTypeReference', (visitor, node, env) => visitor.tsTypeReference(node as AST.TSTypeReference, env) ],
        [ 'TSArrayType', (visitor, node, env) => visitor.tsArrayType(node as AST.TSArrayType, env) ],
        [ 'TSFunctionType', (visitor, node, env) => visitor.tsFunctionType(node as AST.TSFunctionType, env) ],
        [ 'TSUnionType', (visitor, node, env) => visitor.tsUnionType(node as AST.TSUnionType, env) ],
        [ 'TSNumberKeyword', (visitor, node, env) => visitor.tsNumberKeyword(node as AST.TSNumberKeyword, env) ],
        [ 'TSVoidKeyword', (visitor, node, env) => visitor.tsVoidKeyword(node as AST.TSVoidKeyword, env) ],
        [ 'TSBooleanKeyword', (visitor, node, env) => visitor.tsBooleanKeyword(node as AST.TSBooleanKeyword, env) ],
        [ 'TSStringKeyword', (visitor, node, env) => visitor.tsStringKeyword(node as AST.TSStringKeyword, env) ],
        [ 'TSObjectKeyword', (visitor, node, env) => visitor.tsObjectKeyword(node as AST.TSObjectKeyword, env) ],
        [ 'TSAnyKeyword', (visitor, node, env) => visitor.tsAnyKeyword(node as AST.TSAnyKeyword, env) ],
        [ 'TSNullKeyword', (visitor, node, env) => visitor.tsNullKeyword(node as AST.TSNullKeyword, env) ],
        [ 'TSUndefinedKeyword', (visitor, node, env) => visitor.tsUndefinedKeyword(node as AST.TSUndefinedKeyword, env) ],
        [ 'TSTypeAliasDeclaration', (visitor, node, env) => visitor.tsTypeAliasDeclaration(node as AST.TSTypeAliasDeclaration, env) ],
        [ 'ExportNamedDeclaration', (visitor, node, env) => visitor.exportNamedDeclaration(node as AST.ExportNamedDeclaration, env) ],
    ])

    visit(node: Node, env: Environment): void {
        const handler = NodeVisitor.handlers.get(node.type)
        if (handler)
            handler(this, node, env)
        else
            this.unknownNode(node, env)
    }

    unknownNode(node: Node, env: Environment) {
        const err = new ErrorLog()
        throw err.push(`unsupported syntax: ${node.type}`, node)
    }

    abstract file(node: AST.File, env: Environment): void
    abstract program(node: AST.Program, env: Environment): void
    abstract importDeclaration(node: AST.ImportDeclaration, env: Environment): void
    abstract nullLiteral(node: AST.NullLiteral, env: Environment): void
    abstract stringLiteral(node: AST.StringLiteral, env: Environment): void
    abstract booleanLiteral(node: AST.BooleanLiteral, env: Environment): void
    abstract numericLiteral(node: AST.NumericLiteral, env: Environment): void
    abstract identifier(node: AST.Identifier, env: Environment): void
    abstract whileStatement(node: AST.WhileStatement, env: Environment): void
    abstract ifStatement(node: AST.IfStatement, env: Environment): void
    abstract forStatement(node: AST.ForStatement, env: Environment): void
    abstract expressionStatement(node: AST.ExpressionStatement, env: Environment): void
    abstract blockStatement(node: AST.BlockStatement, env: Environment): void
    abstract returnStatement(node: AST.ReturnStatement, env: Environment): void
    abstract emptyStatement(node: AST.EmptyStatement, env: Environment): void
    abstract breakStatement(node: AST.BreakStatement, env: Environment): void
    abstract continueStatement(node: AST.ContinueStatement, env: Environment): void
    abstract classDeclaration(node: AST.ClassDeclaration, env: Environment): void
    abstract classBody(node: AST.ClassBody, env: Environment): void
    abstract classProperty(node: AST.ClassProperty, env: Environment): void
    abstract classMethod(node: AST.ClassMethod, env: Environment): void
    abstract variableDeclaration(node: AST.VariableDeclaration, env: Environment): void
    abstract variableDeclarator(node: AST.VariableDeclarator, env: Environment): void
    abstract functionDeclaration(node: AST.FunctionDeclaration, env: Environment): void
    abstract arrowFunctionExpression(node: AST.ArrowFunctionExpression, env: Environment): void
    abstract unaryExpression(node: AST.UnaryExpression, env: Environment): void
    abstract updateExpression(node: AST.UpdateExpression, env: Environment): void
    abstract binaryExpression(node: AST.BinaryExpression, env: Environment): void
    abstract assignmentExpression(node: AST.AssignmentExpression, env: Environment): void
    abstract logicalExpression(node: AST.LogicalExpression, env: Environment): void
    abstract conditionalExpression(node: AST.ConditionalExpression, env: Environment): void
    abstract callExpression(node: AST.CallExpression, env: Environment): void
    abstract newExpression(node: AST.NewExpression, env: Environment): void
    abstract thisExpression(node: AST.ThisExpression, env: Environment): void
    abstract superExpression(node: AST.Super, env: Environment): void
    abstract arrayExpression(node: AST.ArrayExpression, env: Environment): void
    abstract memberExpression(node: AST.MemberExpression, env: Environment): void
    abstract taggedTemplateExpression(node: AST.TaggedTemplateExpression, env: Environment): void
    abstract tsAsExpression(node: AST.TSAsExpression, env: Environment): void
    abstract tsTypeAnnotation(node: AST.TSTypeAnnotation, env: Environment): void
    abstract tsTypeReference(node: AST.TSTypeReference, env: Environment): void
    abstract tsArrayType(node: AST.TSArrayType, env: Environment): void
    abstract tsFunctionType(node: AST.TSFunctionType, env: Environment): void
    abstract tsUnionType(node: AST.TSUnionType, env: Environment): void
    abstract tsNumberKeyword(node: AST.TSNumberKeyword, env: Environment): void
    abstract tsVoidKeyword(node: AST.TSVoidKeyword, env: Environment): void
    abstract tsBooleanKeyword(node: AST.TSBooleanKeyword, env: Environment): void
    abstract tsStringKeyword(node: AST.TSStringKeyword, env: Environment): void
    abstract tsObjectKeyword(node: AST.TSObjectKeyword, env: Environment): void
    abstract tsAnyKeyword(node: AST.TSAnyKeyword, env: Environment): void
    abstract tsNullKeyword(node: AST.TSNullKeyword, env: Environment): void
    abstract tsUndefinedKeyword(node: AST.TSUndefinedKeyword, env: Environment): void
    abstract tsTypeAliasDeclaration(node: AST.TSTypeAliasDeclaration, env: Environment): void
    abstract exportNamedDeclaration(node: AST.ExportNamedDeclaration, env: Environment): void
}

export class NullVisitor<Environment> extends NodeVisitor<Environment> {
    file(node: AST.File, env: Environment): void {}
    program(node: AST.Program, env: Environment): void {}
    importDeclaration(node: AST.ImportDeclaration, env: Environment): void {}
    nullLiteral(node: AST.NullLiteral, env: Environment): void {}
    stringLiteral(node: AST.StringLiteral, env: Environment): void {}
    booleanLiteral(node: AST.BooleanLiteral, env: Environment): void {}
    numericLiteral(node: AST.NumericLiteral, env: Environment): void {}
    identifier(node: AST.Identifier, env: Environment): void {}
    whileStatement(node: AST.WhileStatement, env: Environment): void {}
    ifStatement(node: AST.IfStatement, env: Environment): void {}
    forStatement(node: AST.ForStatement, env: Environment): void {}
    expressionStatement(node: AST.ExpressionStatement, env: Environment): void {}
    blockStatement(node: AST.BlockStatement, env: Environment): void {}
    returnStatement(node: AST.ReturnStatement, env: Environment): void {}
    emptyStatement(node: AST.EmptyStatement, env: Environment): void {}
    breakStatement(node: AST.BreakStatement, env: Environment): void {}
    continueStatement(node: AST.ContinueStatement, env: Environment): void {}
    classDeclaration(node: AST.ClassDeclaration, env: Environment): void {}
    classBody(node: AST.ClassBody, env: Environment): void {}
    classProperty(node: AST.ClassProperty, env: Environment): void {}
    classMethod(node: AST.ClassMethod, env: Environment): void {}
    variableDeclaration(node: AST.VariableDeclaration, env: Environment): void {}
    variableDeclarator(node: AST.VariableDeclarator, env: Environment): void {}
    functionDeclaration(node: AST.FunctionDeclaration, env: Environment): void {}
    arrowFunctionExpression(node: AST.ArrowFunctionExpression, env: Environment): void {}
    unaryExpression(node: AST.UnaryExpression, env: Environment): void {}
    updateExpression(node: AST.UpdateExpression, env: Environment): void {}
    binaryExpression(node: AST.BinaryExpression, env: Environment): void {}
    assignmentExpression(node: AST.AssignmentExpression, env: Environment): void {}
    logicalExpression(node: AST.LogicalExpression, env: Environment): void {}
    conditionalExpression(node: AST.ConditionalExpression, env: Environment): void {}
    callExpression(node: AST.CallExpression, env: Environment): void {}
    newExpression(node: AST.NewExpression, env: Environment): void {}
    thisExpression(node: AST.ThisExpression, env: Environment): void {}
    superExpression(node: AST.Super, env: Environment): void {}
    arrayExpression(node: AST.ArrayExpression, env: Environment): void {}
    memberExpression(node: AST.MemberExpression, env: Environment): void {}
    taggedTemplateExpression(node: AST.TaggedTemplateExpression, env: Environment): void {}
    tsAsExpression(node: AST.TSAsExpression, env: Environment): void {}
    tsTypeAnnotation(node: AST.TSTypeAnnotation, env: Environment): void {}
    tsTypeReference(node: AST.TSTypeReference, env: Environment): void {}
    tsArrayType(node: AST.TSArrayType, env: Environment): void {}
    tsFunctionType(node: AST.TSFunctionType, env: Environment): void {}
    tsUnionType(node: AST.TSUnionType, env: Environment): void {}
    tsNumberKeyword(node: AST.TSNumberKeyword, env: Environment): void {}
    tsVoidKeyword(node: AST.TSVoidKeyword, env: Environment): void {}
    tsBooleanKeyword(node: AST.TSBooleanKeyword, env: Environment): void {}
    tsStringKeyword(node: AST.TSStringKeyword, env: Environment): void {}
    tsObjectKeyword(node: AST.TSObjectKeyword, env: Environment): void {}
    tsAnyKeyword(node: AST.TSAnyKeyword, env: Environment): void {}
    tsNullKeyword(node: AST.TSNullKeyword, env: Environment): void {}
    tsUndefinedKeyword(node: AST.TSUndefinedKeyword, env: Environment): void {}
    tsTypeAliasDeclaration(node: AST.TSTypeAliasDeclaration, env: Environment): void {}
    exportNamedDeclaration(node: AST.ExportNamedDeclaration, env: Environment): void {}
}

export function file<E>(node: AST.File, env: E, v: NodeVisitor<E>): void {
    v.visit(node.program, env)
}

export function program<E>(node: AST.Program, env: E, v: NodeVisitor<E>): void {
    for (const child of node.body)
        v.visit(child, env)
}

export function whileStatement<E>(node: AST.WhileStatement, env: E, v: NodeVisitor<E>): void {
    v.visit(node.test, env)
    v.visit(node.body, env)
}

export function ifStatement<E>(node: AST.IfStatement, env: E, v: NodeVisitor<E>): void {
    v.visit(node.test, env)
    v.visit(node.consequent, env)
    if (node.alternate)
        v.visit(node.alternate, env)
}

export function forStatement<E>(node: AST.ForStatement, env: E, v: NodeVisitor<E>): void {
    if (node.init)
        v.visit(node.init, env)

    if (node.test)
        v.visit(node.test, env)

    if (node.update)
        v.visit(node.update, env)

    v.visit(node.body, env)
}

export function expressionStatement<E>(node: AST.ExpressionStatement, env: E, v: NodeVisitor<E>): void {
    v.visit(node.expression, env)
}

export function blockStatement<E>(node: AST.BlockStatement, env: E, v: NodeVisitor<E>): void {
    for (const child of node.body)
        v.visit(child, env)
}

export function returnStatement<E>(node: AST.ReturnStatement, env: E, v: NodeVisitor<E>): void {
    if (node.argument)
        v.visit(node.argument, env)
}

export function variableDeclaration<E>(node: AST.VariableDeclaration, env: E, v: NodeVisitor<E>): void {
    for (const decl of node.declarations)
        v.visit(decl, env)
}

export function variableDeclarator<E>(node: AST.VariableDeclarator, env: E, v: NodeVisitor<E>): void {
    if (node.init)
        v.visit(node.init, env)
}

export function functionDeclaration<E>(node: AST.FunctionDeclaration, env: E, v: NodeVisitor<E>): void {
    if (node.id)
        v.visit(node.id, env)

    for (const p of node.params)
        v.visit(p, env)

    v.visit(node.body, env)
}

export function binaryExpression<E>(node: AST.BinaryExpression, env: E, v: NodeVisitor<E>): void {
    v.visit(node.left, env)
    v.visit(node.right, env)
}

export function assignmentExpression<E>(node: AST.AssignmentExpression, env: E, v: NodeVisitor<E>): void {
    v.visit(node.left, env)
    v.visit(node.right, env)
}

export function logicalExpression<E>(node: AST.LogicalExpression, env: E, v: NodeVisitor<E>): void {
    v.visit(node.left, env)
    v.visit(node.right, env)
}

export function callExpression<E>(node: AST.CallExpression, env: E, v: NodeVisitor<E>): void {
    v.visit(node.callee, env)
    for (const a of node.arguments)
        v.visit(a, env)
}
