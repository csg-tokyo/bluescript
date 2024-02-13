// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { ErrorLog } from './utils'
import * as visitor from './visitor'

import { ArrayType, StaticType, isPrimitiveType } from './types'

import {
  Integer, Float, Boolean, String, Void, Null, Any,
  ObjectType, FunctionType, objectType,
  typeToString, isSubtype, isConsistent, commonSuperType,
  isNumeric
} from './types'

import { actualElementType } from './code-generator/c-runtime'

import {
  NameTable, NameTableMaker, BasicGlobalNameTable, NameInfo,
  addNameTable, addStaticType, getStaticType, BasicNameTableMaker,
  addCoercionFlag, getNameTable
} from './names'
import { InstanceType } from './classes'

// entry point for just running a type checker
export function runTypeChecker(ast: AST.Node, names: BasicGlobalNameTable) {
  const maker = new BasicNameTableMaker()
  return typecheck(ast, maker, names)
}

export function typecheck<Info extends NameInfo>(ast: AST.Node, maker: NameTableMaker<Info>, names: NameTable<Info>): NameTable<Info> {
  const typeChecker = new TypeChecker(maker)
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

export default class TypeChecker<Info extends NameInfo> extends visitor.NodeVisitor<NameTable<Info>> {
  maker: NameTableMaker<Info>
  errorLog = new ErrorLog()
  result: StaticType = Any
  firstPass = true

  constructor(maker: NameTableMaker<Info>) {
    super()
    this.maker = maker
  }

  file(node: AST.File, names: NameTable<Info>): void {
    visitor.file(node, names, this)
  }

  program(node: AST.Program, names: NameTable<Info>): void {
    addNameTable(node, names)
    visitor.program(node, names, this)
  }

  importDeclaration(node: AST.ImportDeclaration, env: NameTable<Info>): void {
    // ignore
  }

  nullLiteral(node: AST.NullLiteral, names: NameTable<Info>): void {
    this.result = Null
  }

  stringLiteral(node: AST.StringLiteral, names: NameTable<Info>): void {
    this.result = String
  }

  booleanLiteral(node: AST.BooleanLiteral, names: NameTable<Info>): void {
    this.result = Boolean
  }

  numericLiteral(node: AST.NumericLiteral, names: NameTable<Info>): void {
    const literal = node.extra?.raw as string
    if (/^[0-9A-Fa-fXx]+$/.test(literal))
      this.result = Integer
    else if (/^[0-9.e+\-]+$/.test(literal))
      this.result = Float   // Note that Number(1.0) returns 1.
    else
      this.assert(false, 'bad numeric literal', node)

    this.addStaticType(node, this.result)
  }

  identifier(node: AST.Identifier, names: NameTable<Info>): void {
    const nameInfo = names.lookup(node.name)
    if (nameInfo !== undefined) {
      const info = nameInfo as NameInfo
      if (this.assert(!info.isTypeName, `bad use of type name: ${node.name}`, node)) {
        this.result = info.type
        return
      }
    }
    else
      this.assert(this.firstPass, `unknown name: ${node.name}`, node)

    this.result = Any
  }

  whileStatement(node: AST.WhileStatement, names: NameTable<Info>): void {
    this.visit(node.test, names)
    this.addCoercionForBoolean(node.test, this.result)
    this.visit(node.body, names)
  }

  ifStatement(node: AST.IfStatement, names: NameTable<Info>): void {
    this.visit(node.test, names)
    this.addCoercionForBoolean(node.test, this.result)
    this.visit(node.consequent, names)
    if (node.alternate)
      this.visit(node.alternate, names)
  }

  forStatement(node: AST.ForStatement, names: NameTable<Info>): void {
    const block_names = this.maker.block(names)
    if (!this.firstPass)
      addNameTable(node, block_names)

    if (node.init)
      this.visit(node.init, block_names)

    if (node.test) {
      this.visit(node.test, block_names)
      this.addCoercionForBoolean(node.test, this.result)
    }

    if (node.update)
      this.visit(node.update, block_names)

    this.visit(node.body, block_names)
  }

  expressionStatement(node: AST.ExpressionStatement, names: NameTable<Info>): void {
    this.visit(node.expression, names)
  }

  blockStatement(node: AST.BlockStatement, names: NameTable<Info>): void {
    this.assertSyntax(node.directives.length === 0, node)
    const block_names = this.maker.block(names)
    if (!this.firstPass)
      addNameTable(node, block_names)

    for (const child of node.body)
      this.visit(child, block_names)
  }

  returnStatement(node: AST.ReturnStatement, names: NameTable<Info>): void {
    this.returnStatementArg(node, node.argument, names)
  }

  private returnStatementArg(node: AST.Node, argument: AST.Expression | null | undefined,
                             names: NameTable<Info>): void {
    const rtype = names.returnType()
    this.assert(rtype !== null, 'return must be in a function body', node)
    if (argument) {
      this.visit(argument, names)
      if (rtype == undefined)
        names.setReturnType(this.result)
      else if (isConsistent(this.result, rtype))
        this.addCoercion(argument, this.result)
      else
        this.assert(isSubtype(this.result, rtype),
          `Type '${typeToString(this.result)}' does not match type '${typeToString(rtype)}'`, node)
    }
    else
      if (rtype == undefined)
        names.setReturnType(Void)
      else
        this.assert(rtype === Void, 'a non-void function must return a value', node)
  }

  emptyStatement(node: AST.EmptyStatement, names: NameTable<Info>): void { }

  breakStatement(node: AST.BreakStatement, names: NameTable<Info>): void {
    this.assert(!node.label, 'labeled break is not supported', node)
  }

  continueStatement(node: AST.ContinueStatement, names: NameTable<Info>): void {
    this.assert(!node.label, 'labeled continue is not supported', node)
  }

  classDeclaration(node: AST.ClassDeclaration, names: NameTable<Info>): void {
    if (!node.id) {
      this.assert(false, 'class name must be given', node)
      return
    }

    const className = node.id.name
    if (!this.firstPass) {
      // 2nd phase
      const info = names.lookup(className)
      if (info && info.type instanceof InstanceType) {
        const clazz = info.type
        this.result = clazz
        this.visit(node.body, names)
        names.classTable().addClass(className, clazz)
        this.result = clazz
        return
      }
      else
        throw new Error('fatal: a class was not recorded in the first phase.')
    }

    this.assert(names.isGlobal(), 'a class must be declared at top level', node)
    this.assert(!node.implements, '"implements" is not supported', node)
    this.assert(!node.abstract, 'abstract class is not supported', node)
    const superClassName = node.superClass
    let superClass: ObjectType = objectType
    if (superClassName)
      if (AST.isIdentifier(superClassName)) {
        const info = names.lookup(superClassName.name)
        if (info && info.isTypeName && info.type instanceof ObjectType)
          superClass = info.type
        else
          this.assert(false, 'invalid super class', node)
      }
      else
        this.assertSyntax(false, superClassName)

    const clazz = new InstanceType(className, superClass)
    const success = names.record(className, clazz, this.maker, _ => _.isTypeName = true)
    this.assert(success, `'${className}' class has already been declared`, node)

    this.result = clazz
    this.visit(node.body, names)
    clazz.sortProperties()
    this.result = clazz
  }

  classBody(node: AST.ClassBody, names: NameTable<Info>): void {
    // this.result is a class type.
    const clazz = this.result
    const classBlock = this.maker.block(names)
    classBlock.record('this', clazz, this.maker)
    for (const b of node.body) {
      this.result = clazz
      this.visit(b, classBlock)
    }
  }

  classProperty(node: AST.ClassProperty, names: NameTable<Info>): void {
    if (!this.firstPass)
      return

    const clazz = this.result as InstanceType
    this.assert(!node.static, 'static property is not supported', node)
    this.assert(!node.abstract, 'abstract property is not supported', node)
    this.assert(!node.accessibility, 'cannot specify accessibility', node)
    let name = '??'
    if (AST.isIdentifier(node.key))
      name = node.key.name
    else
      this.assert(false, 'bad property name', node.key)

    this.assert(!node.value, 'initial value is not supported', node)
    if (node.typeAnnotation)
      this.visit(node.typeAnnotation, names)
    else
      this.result = Any

    const success = clazz.addProperty(name, this.result)
    this.assert(success, `duplicate property name: ${name}`, node)
  }

  classMethod(node: AST.ClassMethod, names: NameTable<Info>): void {
    const clazz = this.result as InstanceType
    this.assert(!node.static, 'static method is not supported', node)
    this.assert(!node.abstract, 'abstract method is not supported', node)
    this.assert(node.kind === 'constructor' || node.kind === 'method', 'getter/setter is not supported', node)
    if (this.firstPass)
      if (AST.isIdentifier(node.key)) {
        this.functionDeclarationPass1(node, null, names)
        const ftype = getStaticType(node)
        if (ftype === undefined || !(ftype instanceof FunctionType))
          throw new Error('fatal: a method type is not recorded')
        else {
          this.assert(node.kind !== 'constructor' || ftype.returnType === Void, 'a constructor cannot return a value', node)
          const error = clazz.addMethod(node.key.name, ftype)
          if (error !== undefined)
            this.assert(false, error, node)
        }
      }
      else
        this.assert(false, 'bad method name', node.key)
    else
      this.functionDeclarationPass2(node, names)
  }

  variableDeclaration(node: AST.VariableDeclaration, names: NameTable<Info>): void {
    if (this.isConstFunctionDeclaration(node, names))
      return

    const kind = node.kind
    this.assert(kind === 'const' || kind === 'let', 'only const and let are available', node)
    for (const decl of node.declarations)
      if (this.assert(decl.type === 'VariableDeclarator',
                      `unsupported variable declarator ${decl.type}`, decl))
        this.checkVariableDeclarator(decl, kind === 'const', names)
  }

  variableDeclarator(node: AST.VariableDeclarator, names: NameTable<Info>): void {
    throw new Error('cannot directly visit AST.VariableDeclarator')
  }

  checkVariableDeclarator(node: AST.VariableDeclarator, isConst: boolean, names: NameTable<Info>): void {
    const lvalue = node.id   // LVal = Identifier | ...
    this.assertVariable(lvalue)
    const id = lvalue as AST.Identifier
    const varName = id.name
    let varType: StaticType | undefined = undefined
    const typeAnno = id.typeAnnotation
    let alreadyDeclared = false
    if (!this.firstPass) {
      varType = names.lookupInThis(varName)?.type
      if (varType !== undefined)         // If a variable is global, lookup(varName).type does not return undefined
        alreadyDeclared = true           // during the 2nd pass.  Otherwise, lookup(varName).type returns undefined
    }                                    // since a new NameTable for a block statement is created for the 2nd pass.
                                         // So a local variable is recorded in a NameTable during every phase
                                         // while a global variable is recorded in the first phase only.

    if (varType === undefined && typeAnno != null) {
      this.assertSyntax(AST.isTSTypeAnnotation(typeAnno), typeAnno)
      this.visit(typeAnno, names)
      varType = this.result
    }

    if (node.init) {    // a const declaration must have an initializer.  a let declaration may not.
      this.visit(node.init, names)
      this.assert(this.result !== Void, 'void may not be an initial value', node.init)
      if (varType === undefined)
        varType = this.result
      else if (isConsistent(this.result, varType))
        this.addCoercion(node.init, this.result)
      else
        this.assert(isSubtype(this.result, varType),
          `Type '${typeToString(this.result)}' is not assignable to type '${typeToString(varType)}'`, node)
    }

    if (varType === undefined)
      varType = Any

    if (!alreadyDeclared) {
      const success = names.record(varName, varType, this.maker, _ => _.isConst = isConst)
      this.assert(success, `Identifier '${varName}' has already been declared`, node)
    }
  }

  private isConstFunctionDeclaration(node: AST.VariableDeclaration, names: NameTable<Info>): boolean {
    if (node.kind === 'const' && node.declarations.length === 1 && names.isGlobal()) {
      const decl = node.declarations[0]
      if (decl.init && AST.isArrowFunctionExpression(decl.init)) {
        const func = decl.init
        if (this.firstPass) {
          const declId = decl.id as AST.Identifier
          this.functionDeclarationPass1(func, declId, names)
          const info = names.lookup(declId.name)
          if (info)
            info.isConst = true
        }
        else
          this.functionDeclarationPass2(func, names)

        return true
      }
    }

    return false
  }

  functionDeclaration(node: AST.FunctionDeclaration, names: NameTable<Info>): void {
    this.assert(names.isGlobal(), 'a nested function is not available', node)
    if (this.firstPass)
      this.functionDeclarationPass1(node, node.id, names)
    else
      this.functionDeclarationPass2(node, names)

    // a function is recorded in a NameTable in the first phase only.
  }

  functionDeclarationPass1(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression | AST.ClassMethod,
                           nodeId: AST.Identifier | null | undefined, names: NameTable<Info>): void {
    this.assert(!node.generator, 'generator functions are not supported', node)
    this.assert(!node.async, 'async functions are not supported', node)
    const funcEnv = this.maker.function(names)
    const paramTypes = this.functionParameters(node, funcEnv)
    funcEnv.setReturnType(undefined)
    const typeAnno = node.returnType
    if (typeAnno != null) {
      this.assertSyntax(AST.isTSTypeAnnotation(typeAnno), typeAnno)
      this.visit(typeAnno, names)
      funcEnv.setReturnType(this.result)
    }

    let info: Info | undefined = undefined
    // reports an error when a function is declared more than once
    // within the same global environment.
    if (nodeId != null) {
      info = names.lookup(nodeId.name)
      this.assert(info === undefined || (funcEnv.isFreeInfo(info) && !info.isConst),
            `function '${nodeId.name}' has been already declared`, node)
    }

    let rtype: StaticType | undefined
    if (AST.isBlockStatement(node.body))
      this.visit(node.body, funcEnv)
    else
      this.returnStatementArg(node, node.body, funcEnv)

    rtype = funcEnv.returnType()
    if (rtype === undefined)
      rtype = Void

    const ftype = new FunctionType(rtype, paramTypes)
    addStaticType(node, ftype)
    if (nodeId != null)
      if (info === undefined)   // if new declaration
        names.record(nodeId.name, ftype, this.maker, _ => { _.isFunction = true })
      else
        this.assert(isSubtype(ftype, info.type),
            `function '${nodeId.name}' is declared again with a different type`, node)
  }

  functionDeclarationPass2(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression | AST.ClassMethod,
                           names: NameTable<Info>): void {
    const funcEnv = this.maker.function(names)
    this.functionParameters(node, funcEnv)
    const ftype = getStaticType(node)
    if (ftype === undefined || !(ftype instanceof FunctionType))
      throw new Error(`fatal: a function type is not recorded in pass 1: ${AST.isFunctionDeclaration(node) ? node.id : '(arrow function)'}`)

    funcEnv.setReturnType(ftype.returnType)
    this.visit(node.body, funcEnv)
    addNameTable(node, funcEnv)
  }

  functionParameters(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression | AST.ClassMethod,
                     names: NameTable<Info>): StaticType[] {
    const paramTypes: StaticType[] = []
    for (const param of node.params) {
      this.assert(AST.isIdentifier(param), 'bad parameter name', node)
      const id = param as AST.Identifier
      const varName = id.name
      let varType: StaticType = Any
      const typeAnno = id.typeAnnotation
      if (typeAnno != null) {
        this.assertSyntax(AST.isTSTypeAnnotation(typeAnno), typeAnno)
        this.visit(typeAnno, names)
        varType = this.result
      }

      this.assert(names.record(varName, varType, this.maker),
        `duplicated parameter name: ${varName}`, node)
      paramTypes.push(varType)
    }

    return paramTypes
  }

  arrowFunctionExpression(node: AST.ArrowFunctionExpression, names: NameTable<Info>): void {
    if (this.firstPass)
      this.functionDeclarationPass1(node, null, names)
    else {
      this.functionDeclarationPass2(node, names)
      const funcEnv = getNameTable(node)
      funcEnv?.forEach((info, key) => {
        if (info.captured)
          this.assert(false, `${key} is not accessible within an arrow function`, node)
      })
    }

    const ftype = getStaticType(node)
    if (ftype === undefined || !(ftype instanceof FunctionType))
      throw new Error('fatal: an arrow function type is not recorded')
    else
      this.result = ftype
  }

  unaryExpression(node: AST.UnaryExpression, names: NameTable<Info>): void {
    this.assert(node.prefix, 'only prefixed unary operator is supported', node)
    this.visit(node.argument, names)
    this.addCoercionIfAny(node.argument, this.result)
    const op = node.operator
    if (op === '-' || op === '+')
      this.assert(isNumeric(this.result) || this.result === Any,
        this.invalidOperandMessage(op, this.result), node);
    else if (op === '!') {
      this.addCoercionForBoolean(node.argument, this.result)
      this.result = Boolean
    }
    else if (op === '~') {
      // this.result must be integer or any-type.
      // It must not be an array type or a function type.
      this.assert(this.result === Integer || this.result === Any,
        this.invalidOperandMessage(op, this.result), node)
      this.result = Integer
    }
    else if (op === 'typeof') {
      addStaticType(node.argument, this.result)
      this.result = String
    }
    else  // 'void' | 'delete' | 'throw'
      this.assert(false, `not supported operator ${op}`, node)
  }

  invalidOperandMessage(op: string, t1: StaticType) {
    const t1name = typeToString(t1)
    return `invalid operand to ${op} (${t1name})`
  }

  updateExpression(node: AST.UpdateExpression, names: NameTable<Info>): void {
    // const prefix = node.prefix           true if ++k, but false if k++
    this.assertLvalue(node.argument, names)
    this.visit(node.argument, names)

    const op = node.operator    // ++ or --
    this.assert(isNumeric(this.result) || this.result === Any,
                this.invalidOperandMessage(op, this.result), node);
    this.addCoercion(node.argument, this.result)
  }

  binaryExpression(node: AST.BinaryExpression, names: NameTable<Info>): void {
    this.visit(node.left, names)
    const left_type = this.result
    this.visit(node.right, names)
    const right_type = this.result
    const op = node.operator
    if (op === '==' || op === '!=' || op === '===' || op === '!==') {
      if (left_type === Boolean || right_type === Boolean) {
        this.assert(left_type === right_type, 'a boolean must be compared with a boolean', node)
        this.addCoercion(node.left, left_type)
        this.addCoercion(node.right, right_type)
      }
      else if (left_type === Any || right_type === Any) {
        this.addCoercion(node.left, left_type)
        this.addCoercion(node.right, right_type)
      }
      else
        this.assert(isSubtype(left_type, right_type) || isSubtype(right_type, left_type),
          this.invalidOperandsMessage(op, left_type, right_type), node)

      this.result = Boolean
    }
    else if (op === '<' || op === '<=' || op === '>' || op === '>=') {
      this.assert((isNumeric(left_type) || left_type === Any) && (isNumeric(right_type) || right_type === Any),
        this.invalidOperandsMessage(op, left_type, right_type), node)
      if (left_type === Any || right_type === Any) {
        this.addCoercion(node.left, left_type)
        this.addCoercion(node.right, right_type)
      }
      this.result = Boolean
    }
    else if (op === '+' || op === '-' || op === '*' || op === '/') {
      this.assert((isNumeric(left_type) || left_type === Any) && (isNumeric(right_type) || right_type === Any),
        this.invalidOperandsMessage(op, left_type, right_type), node)
      if (left_type === Any || right_type === Any) {
          this.addCoercion(node.left, left_type)
          this.addCoercion(node.right, right_type)
          this.result = Any
      }
      else if (left_type === Float || right_type === Float)
        this.result = Float
      else
        this.result = Integer
    }
    else if (op === '|' || op === '^' || op === '&' || op === '%' || op === '<<' || op === '>>' || op === '>>>') {
      this.assert(left_type === Integer && right_type === Integer,
        this.invalidOperandsMessage(op, left_type, right_type), node)
      this.result = Integer
    }
    else { // 'in', '**', 'instanceof', '|>'
      this.assert(false, `not supported operator '${op}'`, node)
      this.result = Boolean
    }
  }

  invalidOperandsMessage(op: string, t1: StaticType, t2: StaticType) {
    const t1name = typeToString(t1)
    const t2name = typeToString(t2)
    return `invalid operands to ${op} (${t1name} and ${t2name})`
  }

  assignmentExpression(node: AST.AssignmentExpression, names: NameTable<Info>): void {
    if (AST.isMemberExpression(node.left)) {
      this.memberAssignmentExpression(node, node.left, names)
      return
    }

    this.assertLvalue(node.left, names)
    this.visit(node.left, names)
    const left_type = this.result
    this.visit(node.right, names)
    const right_type = this.result
    const op = node.operator

    if (op === '=')
      if (isConsistent(right_type, left_type) || this.isConsistentOnFirstPass(right_type, left_type)) {
        this.addCoercion(node.left, left_type)
        this.addCoercion(node.right, right_type)
      }
      else
        this.assert(isSubtype(right_type, left_type),
          `Type '${typeToString(right_type)}' is not assignable to type '${typeToString(left_type)}'`,
          node)
    else if (op === '+=' || op === '-=' || op === '*=' || op === '/=') {
      this.assert((isNumeric(left_type) || left_type === Any) && (isNumeric(right_type) || right_type === Any),
        this.invalidOperandsMessage(op, left_type, right_type), node)
      if (left_type === Any || right_type === Any) {    // "if (isConsistent(...))" is wrong
        this.addCoercion(node.left, left_type)
        this.addCoercion(node.right, right_type)
      }
    }
    else if (op === '|=' || op === '^=' || op === '&=' || op === '%=' || op === '<<=' || op === '>>=')
      this.assert(left_type === Integer && right_type === Integer,
        this.invalidOperandsMessage(op, left_type, right_type), node)
    else  // '||=', '&&=', '>>>=', '**=', op === '??='
      this.assert(false, `not supported operator '${op}'`, node)

    this.result = left_type
  }

  memberAssignmentExpression(node: AST.AssignmentExpression, leftNode: AST.MemberExpression, names: NameTable<Info>): void {
    this.assertLvalue(leftNode, names)
    const checked = this.checkMemberExpr(leftNode, false, names)
    if (!checked && leftNode.computed) {    // if an array type is unknown
      this.visit(node.right, names)
      this.result = Any
      return
    }

    const elementType = this.result
    this.visit(node.right, names)
    const rightType = this.result
    const op = node.operator

    // this depends on the implementation of array objects etc.
    let actualType: StaticType
    if (leftNode.computed)
      actualType = actualElementType(elementType)
    else
      if (checked)
        actualType = isPrimitiveType(elementType) ? Any : elementType
      else
        actualType = elementType

    if (op === '=')
      if (isConsistent(rightType, elementType)) {
        this.addCoercion(node.left, actualType)
        this.addCoercion(node.right, rightType)
      }
      else {
        this.assert(isSubtype(rightType, elementType),
          `Type '${typeToString(rightType)}' is not assignable to element type '${typeToString(elementType)}'`,
          node)
        this.addCoercion(node.left, actualType)
        this.addCoercion(node.right, rightType)
      }
    else if (op === '+=' || op === '-=' || op === '*=' || op === '/=') {
      this.assert((isNumeric(elementType) || elementType === Any) && (isNumeric(rightType) || rightType === Any),
        this.invalidOperandsMessage(op, elementType, rightType), node)
      this.addCoercion(node.left, actualType)
      this.addCoercion(node.right, rightType)
    }
    else // '|=', '^=', '&=', '%=', '<<=', '>>=', '||=', '&&=', '>>>=', '**=', op === '??='
      this.assert(false, `not supported operator '${op}'`, node)

    this.result = actualType
  }

  logicalExpression(node: AST.LogicalExpression, names: NameTable<Info>): void {
    this.visit(node.left, names)
    const left_type = this.result
    this.visit(node.right, names)
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

  conditionalExpression(node: AST.ConditionalExpression, names: NameTable<Info>): void {
    this.visit(node.test, names)
    this.addCoercionForBoolean(node.test, this.result)
    this.visit(node.consequent, names)
    const then_type = this.result
    this.visit(node.alternate, names)
    const else_type = this.result
    const result_type = commonSuperType(then_type, else_type)
    if (result_type === undefined) {
      this.assert(false, 'no common super type', node)
      this.result = then_type
    }
    else
      this.result = result_type
  }

  callExpression(node: AST.CallExpression, names: NameTable<Info>): void {
    if (AST.isMemberExpression(node.callee) && this.checkMethodExpr(node.callee, names)) {
      // "node" is a method call and checkMethodExpr() has visited node.callee.
    } else
      this.visit(node.callee, names)

    if (AST.isSuper(node.callee))
      this.superConstructorCall(this.result, node, names)
    else if (this.result instanceof FunctionType) {
      const func_type = this.result
      if (node.arguments.length !== func_type.paramTypes.length)
        this.assert(false, 'wrong number of arguments', node)
      else
        for (let i = 0; i < node.arguments.length; i++) {
          const arg = node.arguments[i]
          const ptype = func_type.paramTypes[i]
          this.callExpressionArg(arg, ptype, names)
        }

      this.addStaticType(node.callee, func_type)
      this.result = func_type.returnType
    }
    else {
      this.assert(this.firstPass, 'the callee is not a function', node.callee)
      this.result = Any
    }
  }

  private callExpressionArg(arg: AST.Node, paramType: StaticType, names: NameTable<Info>) {
    this.visit(arg, names)
    const argType = this.result
    if (isConsistent(argType, paramType) || this.isConsistentOnFirstPass(argType, paramType))
      this.addCoercion(arg, argType)
    else
      this.assert(isSubtype(argType, paramType),
        `passing an incompatible argument (${typeToString(argType)} to ${typeToString(paramType)})`,
        arg)
  }

  private superConstructorCall(type: StaticType, node: AST.CallExpression, names: NameTable<Info>): void {
    const args = node.arguments
    if (type instanceof InstanceType) {
      let consType = type.findConstructor()
      if (!consType)
        consType = new FunctionType(Void, [])

      if (args.length !== consType.paramTypes.length)
        this.assert(false, 'wrong number of arguments', node)
      else
        for (let i = 0; i < args.length; i++)
          this.callExpressionArg(args[i], consType.paramTypes[i], names)

      this.addStaticType(node.callee, consType)
      this.result = Void
    }
    else
      this.assert(false, 'fatal: bad super', node)
  }

  newExpression(node: AST.NewExpression, names: NameTable<Info>): void {
    const className = node.callee
    if (AST.isIdentifier(className)) {
      if (className.name === 'Array') {
        this.newArrayExpression(node, names)
        return
      }
      else {
        const info = names.lookup(className.name)
        if (info?.isTypeName && info.type instanceof InstanceType) {
          this.newObjectExpression(node, info.type, names)
          return
        }
      }
    }

    this.assert(false, 'bad type name for new', node)
  }

  private newArrayExpression(node: AST.NewExpression, names: NameTable<Info>): void {
    const typeParams = node.typeParameters?.params?.map(e => {
      this.visit(e, names)
      return this.result
    })

    let etype: StaticType = Any
    if (typeParams)
      if (this.assert(typeParams.length === 1, 'wrong numberr of type parameters', node))
        etype = typeParams[0]

    const args = node.arguments
    if (this.assert(args.length === 2 || (args.length === 1 && (etype === Integer || etype === Float
                                                                || etype === Boolean || etype === Any)),
                    'wrong number of arguments', node)) {
      this.callExpressionArg(args[0], Integer, names)
      if (args.length === 2)
        this.callExpressionArg(args[1], etype, names)
    }

    const atype = new ArrayType(etype)
    this.addStaticType(node, atype)
    this.result = atype
  }

  private newObjectExpression(node: AST.NewExpression, type: InstanceType, names: NameTable<Info>): void {
    const args = node.arguments
    let consType = type.findConstructor()
    if (!consType)
      consType = new FunctionType(Void, [])

    if (args.length !== consType.paramTypes.length)
      this.assert(false, 'wrong number of arguments', node)
    else
      for (let i = 0; i < args.length; i++)
        this.callExpressionArg(args[i], consType.paramTypes[i], names)

    this.addStaticType(node, type)
    this.result = type
  }

  thisExpression(node: AST.ThisExpression, names: NameTable<Info>): void {
    const nameInfo = names.lookup('this')
    if (nameInfo !== undefined) {
      this.assert(nameInfo.type instanceof InstanceType, `the type of 'this' is broken`, node)
      this.result = nameInfo.type
    }
    else {
      this.assert(this.firstPass, `'this' is not available here`, node)
      this.result = Any
    }
  }

  superExpression(node: AST.Super, names: NameTable<Info>): void {
    const nameInfo = names.lookup('this')
    if (nameInfo?.type instanceof InstanceType) {
      const t = nameInfo.type.superType()
      if (t !== null) {
        this.result = t
        return
      }
    }

    this.assert(this.firstPass, `'super' is not available here`, node)
    this.result = Any
  }

  arrayExpression(node: AST.ArrayExpression, names: NameTable<Info>): void {
    let etype: StaticType | undefined = undefined
    for (const ele of node.elements)
      if (AST.isExpression(ele)) {
        this.visit(ele, names)
        this.addStaticType(ele, this.result)
        if (etype === undefined)
          etype = this.result
        else {
          const t = commonSuperType(etype, this.result)
          if (t === undefined)
            etype = Any
          else
            etype = t
        }
      }
      else
        this.assert(false, 'unsupported array element', node)

    if (etype === undefined)
      etype = Any     // the type of an empty array is any[]

    const atype = new ArrayType(etype)
    this.addStaticType(node, atype)
    this.result = atype
  }

  memberExpression(node: AST.MemberExpression, names: NameTable<Info>): void {
    // an array access is recognized as a member access.
    this.checkMemberExpr(node, true, names)
  }

  // This returns false when the given expression is an array access but the array type
  // is unknown.  It also returns false when the given expression is a property access
  // like a.b and the property is unboxed.  Otherwise, it returns true.
  private checkMemberExpr(node: AST.MemberExpression, immutable: boolean, names: NameTable<Info>) {
    this.assert(AST.isExpression(node.object), 'not supported object', node.object)
    if (node.computed) {
      // an array access like a[b]
      this.assert(AST.isExpression(node.property), 'a wrong index expression', node.property)
      this.visit(node.property, names)
      this.assert(this.firstPass || this.result === Integer || this.result === Any,
                'an array index must be an integer', node.property)
      this.addCoercionIfAny(node.property, this.result)
      this.visit(node.object, names)
      if (this.result instanceof ArrayType) {
        this.result = this.result.elementType
        this.addStaticType(node, this.result)
      }
      else {
        this.assert(this.firstPass, 'an element access to a non-array', node.object)
        return false    // an array access but the object is unknown.
      }
    }
    else {
      // a property access like a.b
      if (AST.isIdentifier(node.property)) {
        const propertyName = node.property.name
        this.visit(node.object, names)
        const type = this.result
        this.addStaticType(node.object, type)
        if (type instanceof InstanceType) {
          const typeAndIndex  = type.findProperty(propertyName)
          if (typeAndIndex) {
            this.result = typeAndIndex[0]
            const unboxed = type.unboxedProperties()
            return unboxed === undefined || unboxed <= typeAndIndex[1]
          }
        }
        else if (type instanceof ArrayType) {
          if (propertyName === 'length') {
            this.assert(immutable, 'cannot change .length', node.property)
            this.result = Integer
            return false  // an uboxed value.
          }
        }

        this.assert(false, `unknown property name: ${propertyName}`, node.property)
      }
      else
        this.assert(AST.isIdentifier(node.property), 'a wrong property name', node.property)
    }

    return true
  }

  // returns true if "node" is a method
  private checkMethodExpr(node: AST.MemberExpression, names: NameTable<Info>): boolean {
    if (node.computed)
      return false    // an array access like a[i]

    if (!AST.isIdentifier(node.property))
      return false

    const propertyName = node.property.name
    this.visit(node.object, names)
    const type = this.result
    this.addStaticType(node.object, type)
    if (type instanceof InstanceType) {
      const typeAndIndex  = type.findMethod(propertyName)
      if (typeAndIndex) {
        this.result = typeAndIndex[0]
        return true
      }
    }
    else if (type instanceof ArrayType) {
      // no method available
    }

    return false
  }

  taggedTemplateExpression(node: AST.TaggedTemplateExpression, names: NameTable<Info>): void {
    this.assert(AST.isIdentifier(node.tag) && node.tag.name === 'code',
                'a tagged template is not supported', node)
    this.assert(node.quasi.expressions.length === 0 && node.quasi.quasis.length === 1,
                'string interpolation is not supported', node)
    this.result = Void
  }

  tsAsExpression(node: AST.TSAsExpression, names: NameTable<Info>): void {
    this.visit(node.expression, names)
    const exprType = this.result
    this.visit(node.typeAnnotation, names)
    const asType = this.result
    if (!isSubtype(exprType, asType)
        && !(isNumeric(exprType) && isNumeric(asType))
        && !isConsistent(exprType, asType)
        && !(asType instanceof ObjectType && isSubtype(asType, exprType)))
      this.assert(false, this.invalidOperandsMessage('as', exprType, asType), node)

    this.addStaticType(node.expression, exprType)
    this.addStaticType(node, asType)
    this.result = asType
  }

  tsTypeAnnotation(node: AST.TSTypeAnnotation, names: NameTable<Info>): void {
    this.visit(node.typeAnnotation, names)
  }

  tsTypeReference(node: AST.TSTypeReference, names: NameTable<Info>): void {
    this.assertSyntax(AST.isIdentifier(node.typeName), node)
    this.assertSyntax(node.typeParameters === undefined, node)
    const name = (node.typeName as AST.Identifier).name
    if (name === Float)
      this.result = Float
    else if (name === Integer)
      this.result = Integer
    else {
      const nameInfo = names.lookup(name)
      if (this.assert(nameInfo !== undefined, `unknown type name: ${name}`, node)) {
        const info = nameInfo as NameInfo
        const isType = info.isTypeName
        if (this.assert(isType, `not a type name: ${name}`, node)) {
          this.result = info.type
          return
        }
      }

      this.result = Any
    }
  }

  tsArrayType(node: AST.TSArrayType, names: NameTable<Info>): void {
    this.visit(node.elementType, names)
    const elementType = this.result
    this.result = new ArrayType(elementType);
  }

  tsFunctionType(node: AST.TSFunctionType, names: NameTable<Info>): void {
    const params = node.parameters.map(e => {
      if (e.typeAnnotation) {
        this.visit(e.typeAnnotation, names);
        return this.result
      }
      else
        return Any
    })
    let ret: StaticType
    if (node.typeAnnotation) {
      this.visit(node.typeAnnotation, names)
      ret = this.result
    }
    else
      ret = Any

    this.result = new FunctionType(ret, params)
  }

  tsNumberKeyword(node: AST.TSNumberKeyword, names: NameTable<Info>): void {
    this.result = Integer
  }

  tsVoidKeyword(node: AST.TSVoidKeyword, names: NameTable<Info>): void {
    this.result = Void
  }

  tsBooleanKeyword(node: AST.TSBooleanKeyword, names: NameTable<Info>): void {
    this.result = Boolean
  }

  tsStringKeyword(node: AST.TSStringKeyword, names: NameTable<Info>): void {
    this.result = String
  }

  tsObjectKeyword(node: AST.TSObjectKeyword, names: NameTable<Info>): void {
    this.result = objectType
  }

  tsAnyKeyword(node: AST.TSAnyKeyword, names: NameTable<Info>): void {
    this.result = Any
  }

  tsNullKeyword(node: AST.TSNullKeyword, names: NameTable<Info>): void {
    this.result = Null
  }

  tsUndefinedKeyword(node: AST.TSUndefinedKeyword, names: NameTable<Info>): void {
    // we do not distinguish null type and undefined type
    this.result = Null
  }

  tsTypeAliasDeclaration(node: AST.TSTypeAliasDeclaration, env: NameTable<Info>): void {
    const name = node.id.name
    this.assert(name === 'integer' || name === 'float', 'type alias is not supported', node)
  }

  exportNamedDeclaration(node: AST.ExportNamedDeclaration, env: NameTable<Info>): void {
    if (node.declaration != undefined)
      this.visit(node.declaration, env);
  }

  isConsistentOnFirstPass(t1: StaticType, t2: StaticType) {
    if (this.firstPass)
      return t1 === Any && t2 instanceof ArrayType
             || t1 instanceof ArrayType && t2 === Any
    else
      return false
  }

  addStaticType(expr: AST.Node, type: StaticType) {
    if (!this.firstPass)
      addStaticType(expr, type)
  }

  addCoercion(expr: AST.Node, type: StaticType) {
    if (!this.firstPass) {
      addStaticType(expr, type)
      addCoercionFlag(expr, true)
    }
  }

  addCoercionIfAny(expr: AST.Node, type: StaticType): void {
    // if the expression type is Any type, mark it for coercion
    if (!this.firstPass && type === Any)
      this.addCoercion(expr, type)
  }

  addCoercionForBoolean(expr: AST.Node, type: StaticType): void {
    // if the expression needs coercion to be tested as a boolean value.
    // In C, 0, 0.0, and NULL are false.
    // Note that a Null-type value might not be NULL.
    if (!this.firstPass && !isPrimitiveType(type))
      this.addCoercion(expr, type)
  }

  assertLvalue(node: AST.Node, table: NameTable<Info>) {
    if (AST.isIdentifier(node)) {
      const info = table.lookup(node.name)
      if (info !== undefined) {
        this.assert(!info.isConst, 'assignment to constant variable', node)
        this.assert(!info.isFunction, 'assignment to top-level function', node)
      }
    }
    else if (AST.isMemberExpression(node)) {
    }
    else
      this.assert(false, 'invalid left-hand side in assignment', node)
  }

  assertVariable(node: AST.Node) {
    this.assert(AST.isIdentifier(node), 'invalid variable name', node)
  }

  assertSyntax(test: boolean, node: AST.Node) {
    this.assert(test, 'syntax error', node)
  }

  assert(test: boolean, msg: string, node: AST.Node) {
    if (!test)
      this.errorLog.push(msg, node)

    return test
  }
}
