import { Identifier, Node } from "@babel/types"
import * as AST from "@babel/types"
import { ErrorLog } from "../utils"
import Environment, * as visitor from "../visitor"

import type { StaticType } from "../types"

import {
  Integer, Float, Boolean, String, Void, Null, Any,
  ObjectType, FunctionType, objectType,
  typeToString, isSubtype, isConsistent, commonSuperType
} from "../types"

import {
  NameInfo, NameTable, BlockNameTable, addNameTable,
  getNameTable, addStaticType, FunctionNameTable, getStaticType, GlobalNameTable
} from "./names"


export function runTypeChecker(ast: Node, env: GlobalNameTable): GlobalNameTable {
  const typeChecker = new TypeChecker()
  typeChecker.firstPass = true
  typeChecker.result = Any
  typeChecker.visit(ast, env)
  if (typeChecker.errorLog.hasError())
    throw typeChecker.errorLog

  typeChecker.firstPass = false
  typeChecker.result = Any
  typeChecker.visit(ast, env)
  if (typeChecker.errorLog.hasError())
    throw typeChecker.errorLog

  return env
}

export default class TypeChecker extends visitor.NodeVisitor {
  errorLog = new ErrorLog()
  result: StaticType = Any
  firstPass = true

  file(node: AST.File, env: Environment): void {
    visitor.file(node, env, this)
  }

  program(node: AST.Program, env: Environment): void {
    addNameTable(node, env as NameTable)
    visitor.program(node, env, this)
  }

  nullLiteral(node: AST.NullLiteral, env: Environment): void {
    this.result = Null
  }

  stringLiteral(node: AST.StringLiteral, env: Environment): void {
    this.result = String
  }

  booleanLiteral(node: AST.BooleanLiteral, env: Environment): void {
    this.result = Boolean
  }

  numericLiteral(node: AST.NumericLiteral, env: Environment): void {
    if (Number.isInteger(node.value))
      this.result = Integer
    else
      this.result = Float
  }

  identifier(node: AST.Identifier, env: Environment): void {
    const names = env as NameTable
    const name_info = names.lookup(node.name)
    if (name_info !== undefined) {
      const info = name_info as NameInfo
      if (this.assert(!info.isTypeName(), `bad use of type name: ${node.name}`, node)) {
        this.result = info.type
        return
      }
    }
    else
      this.assert(this.firstPass, `unknown name: ${node.name}`, node)

    this.result = Any
  }

  whileStatement(node: AST.WhileStatement, env: Environment): void {
    this.visit(node.test, env)
    this.addCoercionForBoolean(node.test, this.result)
    this.visit(node.body, env)
  }

  ifStatement(node: AST.IfStatement, env: Environment): void {
    this.visit(node.test, env)
    this.addCoercionForBoolean(node.test, this.result)
    this.visit(node.consequent, env)
    if (node.alternate)
      this.visit(node.alternate, env)
  }

  forStatement(node: AST.ForStatement, env: Environment): void {
    const block_env = new BlockNameTable(env as NameTable)
    if (!this.firstPass)
      addNameTable(node, block_env)

    if (node.init)
      this.visit(node.init, block_env)

    if (node.test) {
      this.visit(node.test, block_env)
      this.addCoercionForBoolean(node.test, this.result)
    }

    if (node.update)
      this.visit(node.update, block_env)

    this.visit(node.body, block_env)
  }

  expressionStatement(node: AST.ExpressionStatement, env: Environment): void {
    this.visit(node.expression, env)
  }

  blockStatement(node: AST.BlockStatement, env: Environment): void {
    this.assertSyntax(node.directives.length === 0, node)
    const block_env = new BlockNameTable(env as NameTable)
    if (!this.firstPass)
      addNameTable(node, block_env)

    for (const child of node.body)
      this.visit(child, block_env)
  }

  returnStatement(node: AST.ReturnStatement, env: Environment): void {
    const names = env as NameTable
    const rtype = names.returnType()
    this.assert(rtype !== null, 'return must be in a function body', node)
    if (node.argument) {
      this.visit(node.argument, env)
      if (rtype == undefined)
        names.setReturnType(this.result)
      else if (isConsistent(this.result, rtype))
        this.addStaticType(node.argument, this.result)
      else
        this.assert(isSubtype(this.result, rtype),
          `Type '${typeToString(this.result)}' does not match type '${typeToString(rtype)}'.`, node)
    }
    else
      if (rtype == undefined)
        names.setReturnType(Void)
      else
        this.assert(rtype === Void, 'a void function cannot return a value', node)
  }

  emptyStatement(node: AST.EmptyStatement, env: Environment): void { }

  breakStatement(node: AST.BreakStatement, env: Environment): void {
    this.assert(!node.label, 'labeled break is not supported', node)
  }

  continueStatement(node: AST.ContinueStatement, env: Environment): void {
    this.assert(!node.label, 'labeled continue is not supported', node)
  }

  variableDeclaration(node: AST.VariableDeclaration, env: Environment): void {
    const kind = node.kind
    this.assert(kind === 'const' || kind === 'let', 'only const and let are available', node)
    for (const decl of node.declarations)
      this.visit(decl, env)
  }

  variableDeclarator(node: AST.VariableDeclarator, env: Environment): void {
    const lvalue = node.id   // LVal = Identifier | ...
    this.assertLvalue(lvalue)
    const id = lvalue as Identifier
    const varName = id.name
    let varType: StaticType | undefined = undefined
    const typeAnno = id.typeAnnotation
    let alreadyDeclared = false
    if (!this.firstPass) {
      varType = (env as NameTable).lookup(varName)?.type
      if (varType !== undefined)         // If a variable is global, lookup() does not return undefined
        alreadyDeclared = true         // during the 2nd pass.  Otherwise, lookup() returns undefined.
    }

    if (varType === undefined && typeAnno != null) {
      this.assertSyntax(AST.isTSTypeAnnotation(typeAnno), typeAnno)
      this.visit(typeAnno, env)
      varType = this.result
    }

    if (node.init) {    // a const declaration must have an initializer.  a let declaration may not.
      this.visit(node.init, env)
      this.assert(this.result !== Void, 'void may not be an initial value.', node.init)
      if (varType === undefined)
        varType = this.result
      else if (isConsistent(this.result, varType))
        this.addStaticType(node.init, this.result)
      else
        this.assert(isSubtype(this.result, varType),
          `Type '${typeToString(this.result)}' is not assignable to type '${typeToString(varType)}'.`, node)
    }

    if (varType === undefined)
      varType = Any

    if (!alreadyDeclared) {
      const success = (env as NameTable).record(varName, varType)
      this.assert(success, `Identifier '${varName}' has already been declared..`, node)
    }
  }

  functionDeclaration(node: AST.FunctionDeclaration, env: Environment): void {
    if (this.firstPass)
      this.functionDeclarationPass1(node, env)
    else
      this.functionDeclarationPass2(node, env)
  }

  functionDeclarationPass1(node: AST.FunctionDeclaration, env: Environment): void {
    this.assert(!node.generator, 'generator functions are not supported.', node)
    this.assert(!node.async, 'async functions are not supported.', node)
    const outerEnv = env as NameTable
    const funcEnv = new FunctionNameTable(outerEnv)
    const paramTypes = this.functionParameters(node, funcEnv)
    funcEnv.thisReturnType = undefined
    const typeAnno = node.returnType
    if (typeAnno != null) {
      this.assertSyntax(AST.isTSTypeAnnotation(typeAnno), typeAnno)
      this.visit(typeAnno, env)
      funcEnv.thisReturnType = this.result
    }

    if (node.id != null)
      this.assert(outerEnv.lookup(node.id.name) === undefined,
        `function '${node.id.name}' has been already declared.`, node)

    this.visit(node.body, funcEnv)
    let rtype: StaticType
    if (funcEnv.thisReturnType === undefined)
      rtype = Void
    else
      rtype = funcEnv.thisReturnType

    const ftype = new FunctionType(rtype, paramTypes)
    addStaticType(node, ftype)
    if (node.id != null)
      outerEnv.record(node.id.name, ftype)
  }

  functionDeclarationPass2(node: AST.FunctionDeclaration, env: Environment): void {
    const outerEnv = env as NameTable
    const funcEnv = new FunctionNameTable(outerEnv)
    this.functionParameters(node, funcEnv)
    const ftype = getStaticType(node)
    if (ftype === undefined || !(ftype instanceof FunctionType))
      throw Error(`fatal: a function type is not recorded in pass 1: ${node.id}`)

    funcEnv.thisReturnType = ftype.returnType
    this.visit(node.body, funcEnv)
  }

  functionParameters(node: AST.FunctionDeclaration, env: NameTable): StaticType[] {
    const paramTypes: StaticType[] = []
    for (const param of node.params) {
      this.assert(AST.isIdentifier(param), 'bad parameter name', node)
      const id = param as Identifier
      const varName = id.name
      let varType: StaticType = Any
      const typeAnno = id.typeAnnotation
      if (typeAnno != null) {
        this.assertSyntax(AST.isTSTypeAnnotation(typeAnno), typeAnno)
        this.visit(typeAnno, env)
        varType = this.result
      }

      this.assert(env.lookup(varName)?.type == undefined,
        `duplicated parameter name: ${varName}`, node)
      env.record(varName, varType)
      paramTypes.push(varType)
    }

    return paramTypes
  }

  unaryExpression(node: AST.UnaryExpression, env: Environment): void {
    this.assert(node.prefix, 'prefixed unary operator is not supported', node)
    this.visit(node.argument, env)
    this.addCoercionIfAny(node.argument, this.result)
    const op = node.operator
    if (op === '-' || op === '+')
      this.assert(this.isNumeric(this.result),
        this.invalidOperandMessage(op, this.result), node);
    else if (op === '!') {
      this.addCoercionForBoolean(node.argument, this.result)
      this.result = Boolean
    }
    else if (op === '~') {
      this.assert(this.result === Integer,
        this.invalidOperandMessage(op, this.result), node)
    }
    else  // 'typeof' | 'void' | 'delete' | 'throw'
      this.assert(false, `not supported operator ${op}.`, node)
  }

  invalidOperandMessage(op: string, t1: StaticType) {
    const t1name = typeToString(t1)
    return `invalid operand to ${op} (${t1name}).`
  }

  updateExpression(node: AST.UpdateExpression, env: Environment): void {
    // const prefix = node.prefix           true if ++k, but false if k++
    this.assertLvalue(node.argument)
    this.visit(node.argument, env)
    const op = node.operator    // ++ or --
    this.assert(this.isNumeric(this.result),
      this.invalidOperandMessage(op, this.result), node);
  }

  binaryExpression(node: AST.BinaryExpression, env: Environment): void {
    this.visit(node.left, env)
    const left_type = this.result
    this.visit(node.right, env)
    const right_type = this.result
    const op = node.operator
    if (op === '==' || op === '!=' || op === '===' || op === '!==') {
      if (left_type === Boolean || right_type === Boolean) {
        this.assert(left_type === right_type, 'a boolean must be compared with a boolean', node)
        this.addStaticType(node.left, left_type)
        this.addStaticType(node.right, right_type)
      }
      else if (left_type === Any || right_type === Any) {
        this.addStaticType(node.left, left_type)
        this.addStaticType(node.right, right_type)
      }
      else
        this.assert(isSubtype(left_type, right_type) || isSubtype(right_type, left_type),
          this.invalidOperandsMessage(op, left_type, right_type), node)

      this.result = Boolean
    }
    else if (op === '<' || op === '<=' || op === '>' || op === '>=') {
      this.assert(this.isNumeric(left_type) && this.isNumeric(right_type),
        this.invalidOperandsMessage(op, left_type, right_type), node)
      this.result = Boolean
    }
    else if (op === '+' || op === '-' || op === '*' || op === '/') {
      this.assert(this.isNumeric(left_type) && this.isNumeric(right_type),
        this.invalidOperandsMessage(op, left_type, right_type), node)
      if (left_type === Float || right_type === Float)
        this.result = Float
      else
        this.result = Integer
    }
    else if (op === '|' || op === '^' || op === '&' || op === '%' || op === '<<' || op === '>>') {
      this.assert(left_type === Integer && right_type === Integer,
        this.invalidOperandsMessage(op, left_type, right_type), node)
      this.result = Integer
    }
    else { // 'in', '>>>', '**', 'instanceof', '|>'
      this.assert(false, `not supported operator '${op}'`, node)
      this.result = Boolean
    }
  }

  invalidOperandsMessage(op: string, t1: StaticType, t2: StaticType) {
    const t1name = typeToString(t1)
    const t2name = typeToString(t2)
    return `invalid operands to ${op} (${t1name} and ${t2name}).`
  }

  assignmentExpression(node: AST.AssignmentExpression, env: Environment): void {
    this.assertLvalue(node.left)
    this.visit(node.left, env)
    const left_type = this.result
    this.visit(node.right, env)
    const right_type = this.result
    const op = node.operator
    if (op === '=')
      if (isConsistent(right_type, left_type)) {
        this.addStaticType(node.left, left_type)
        this.addStaticType(node.right, right_type)
      }
      else
        this.assert(isSubtype(right_type, left_type),
          `Type '${typeToString(right_type)}' is not assignable to type '${typeToString(left_type)}'.`,
          node)
    else if (op === '+=' || op === '-=' || op === '*=' || op === '/=' || op === '%=')
      this.assert(this.isNumeric(left_type) && this.isNumeric(right_type),
        this.invalidOperandsMessage(op, left_type, right_type), node)
    else if (op === '|=' || op === '^=' || op === '&=' || op === '<<=' || op === '>>=')
      this.assert(left_type === Integer && right_type === Integer,
        this.invalidOperandsMessage(op, left_type, right_type), node)
    else  // '||=', '&&=', '>>>=', '**=', op === '??='
      this.assert(false, `not supported operator '${op}'`, node)

    this.result = left_type
  }

  logicalExpression(node: AST.LogicalExpression, env: Environment): void {
    this.visit(node.left, env)
    const left_type = this.result
    this.visit(node.right, env)
    const right_type = this.result
    const op = node.operator
    if (op === '||' || op === '&&') {
      this.addCoercionForBoolean(node.left, left_type)
      this.addCoercionForBoolean(node.right, right_type)
      this.result = Boolean
    }
    else  // '??'
      this.assert(false, `not supported operator '${op}'`, node)
  }

  conditionalExpression(node: AST.ConditionalExpression, env: Environment): void {
    this.visit(node.test, env)
    this.addCoercionForBoolean(node.test, this.result)
    this.visit(node.consequent, env)
    const then_type = this.result
    this.visit(node.alternate, env)
    const else_type = this.result
    const result_type = commonSuperType(then_type, else_type)
    if (result_type === undefined) {
      this.assert(false, 'no common super type', node)
      this.result = then_type
    }
    else
      this.result = result_type
  }

  callExpression(node: AST.CallExpression, env: Environment): void {
    this.visit(node.callee, env)
    if (this.result instanceof FunctionType) {
      const func_type = this.result
      for (let i = 0; i < node.arguments.length; i++) {
        const arg = node.arguments[i]
        this.visit(arg, env)
        if (isConsistent(this.result, func_type.paramTypes[i]))
          this.addStaticType(arg, this.result)
        else
          this.assert(isSubtype(this.result, func_type.paramTypes[i]),
            `passing an incompatible argument (${this.result} to ${func_type.paramTypes[i]})`,
            node)
      }
      this.result = func_type.returnType
    }
    else {
      this.assert(this.firstPass, 'the callee is not a function', node.callee)
      this.result = Any
    }
  }

  tsAsExpression(node: AST.TSAsExpression, env: Environment): void {
    this.visit(node.expression, env)
    const exprType = this.result
    this.visit(node.typeAnnotation, env)
    const asType = this.result
    this.assert(exprType === Any || asType === Any,
      this.invalidOperandsMessage('as', exprType, this.result), node)
    this.result = asType
  }

  tsTypeAnnotation(node: AST.TSTypeAnnotation, env: Environment): void {
    this.visit(node.typeAnnotation, env)
  }

  tsTypeReference(node: AST.TSTypeReference, env: Environment): void {
    this.assertSyntax(AST.isIdentifier(node.typeName), node)
    this.assertSyntax(node.typeParameters === undefined, node)
    const name = (node.typeName as Identifier).name
    if (name === Float)
      this.result = Float
    else if (name === Integer)
      this.result = Integer
    else {
      const name_info = (env as NameTable).lookup(name)
      if (this.assert(name_info !== undefined, `unknown type name: ${name}`, node)) {
        const info = name_info as NameInfo
        const is_type = info.isTypeName()
        if (this.assert(is_type, `not a type name: ${name}`, node)) {
          this.result = info.type
          return
        }
      }

      this.result = Any
    }
  }

  tsNumberKeyword(node: AST.TSNumberKeyword, env: Environment): void {
    this.result = Integer
  }

  tsVoidKeyword(node: AST.TSVoidKeyword, env: Environment): void {
    this.result = Void
  }

  tsBooleanKeyword(node: AST.TSBooleanKeyword, env: Environment): void {
    this.result = Boolean
  }

  tsStringKeyword(node: AST.TSStringKeyword, env: Environment): void {
    this.result = String
  }

  tsObjectKeyword(node: AST.TSObjectKeyword, env: Environment): void {
    this.result = objectType
  }

  tsAnyKeyword(node: AST.TSAnyKeyword, env: Environment): void {
    this.result = Any
  }

  tsNullKeyword(node: AST.TSNullKeyword, env: Environment): void {
    this.result = Null
  }

  tsUndefinedKeyword(node: AST.TSUndefinedKeyword, env: Environment): void {
    // we do not distinguish null type and undefined type
    this.result = Null
  }

  isNumeric(t: StaticType) {
    return t === Integer || t === Float
  }

  addStaticType(expr: Node, type: StaticType) {
    if (!this.firstPass)
      addStaticType(expr, type)
  }

  addCoercionIfAny(expr: Node, type: StaticType): void {
    // if the expression type is Any type, mark it for coercion
    if (!this.firstPass && type === Any)
      addStaticType(expr, type)
  }

  addCoercionForBoolean(expr: Node, type: StaticType): void {
    // if the expression needs coercion to be tested as a boolean value.
    // In C, 0, 0.0, and NULL are false.
    this.addCoercionIfAny(expr, type)
  }

  assertLvalue(node: Node) {
    this.assert(AST.isIdentifier(node), 'invalid left-hand side in assignment.', node)
  }

  assertSyntax(test: boolean, node: Node) {
    this.assert(test, 'syntax error', node)
  }

  assert(test: boolean, msg: string, node: Node) {
    if (!test)
      this.errorLog.push(msg, node)

    return test
  }
}
