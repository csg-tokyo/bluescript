import * as AST from '@babel/types'
import { runBabelParser, ErrorLog, CodeWriter } from '../utils'
import { Integer, Float, Boolean, String, Void, Null, Any,
         ObjectType, FunctionType,
         StaticType, isPrimitiveType, encodeType, sameType } from '../types'
import * as visitor from '../visitor'
import { getCoercionFlag, getStaticType } from '../type-checker/names'
import { typecheck } from '../type-checker/type-checker'
import { VariableInfo, VariableEnv, GlobalEnv, FunctionEnv, VariableNameTableMaker,
         GlobalVariableNameTable, getVariableNameTable } from './variables'
import * as cr from './c-runtime'

// sessionId: an integer more than zero.  It is used for generating a unique name.
export function transpile(sessionId: number, src: string, gvnt?: GlobalVariableNameTable,
                          startLine: number = 1, header: string = '') {
  const ast = runBabelParser(src, startLine);
  const maker = new VariableNameTableMaker()
  const nameTable = new GlobalVariableNameTable(gvnt)
  typecheck(ast, maker, nameTable)
  const nullEnv = new GlobalEnv(new GlobalVariableNameTable(), cr.globalRootSetName)
  const mainFuncName = `${cr.mainFunctionName}${sessionId}`
  const generator = new CodeGenerator(mainFuncName, `${cr.globalRootSetName}${sessionId}`)
  generator.visit(ast, nullEnv)   // nullEnv will not be used.
  if (generator.errorLog.hasError())
    throw generator.errorLog
  else
    return { code: generator.getCode(header),
             main: mainFuncName, names: nameTable }
}

export class CodeGenerator extends visitor.NodeVisitor<VariableEnv> {
  errorLog = new ErrorLog()
  private result =  new CodeWriter()
  private signatures = ''                   // function prototypes etc.
  private declarations = new CodeWriter()   // function declarations etc.
  private endWithReturn = false
  private initializerName                   // the name of an initializer function
  private globalRootSetName                 // the rootset name for global variables

  constructor(initializerName: string, globalRootsetName: string) {
    super()
    this.initializerName = initializerName
    this.globalRootSetName = globalRootsetName
  }

  getCode(header: string) {
    return `${this.signatures}${header}${this.declarations.getCode()}${this.result.getCode()}`
  }

  file(node: AST.File, env: VariableEnv): void {
    visitor.file(node, env, this)
  }

  program(node: AST.Program, env: VariableEnv): void {
    const env2 = new GlobalEnv(getVariableNameTable(node), this.globalRootSetName)
    const size = env2.allocateRootSet()
    const oldResult = this.result
    this.result = new CodeWriter().right()
    for (const child of node.body)
      this.visit(child, env2);

    const externalRoots: { [key: string]: boolean } = {}
    env2.forEachExternalVariable((name, type) => {
      if (type === Null) {
        if (externalRoots[name])
          externalRoots[name] = true
          this.signatures += `extern ${cr.declareRootSet(name, 1)}\n`
      }
      else if (type instanceof FunctionType)
        this.signatures += this.makeFunctionStruct(name, type)
      else
        this.signatures += `extern ${cr.typeToCType(type, name)};\n`
    })

    this.signatures += `void ${this.initializerName}();\n${cr.declareRootSet(this.globalRootSetName, size)}\n`
    oldResult.write(`\nvoid ${this.initializerName}() {`)
             .right().nl()
             .write(cr.initRootSet(this.globalRootSetName, size))
             .nl().write(cr.makeRootSet(env2.getNumOfVars()))
             .write(this.result.getCode())
             .nl().write(cr.deleteRootSet)
             .left().write('\n}\n')

    this.result = oldResult
  }

  importDeclaration(node: AST.ImportDeclaration, env: VariableEnv): void {
    // ignore
  }

  nullLiteral(node: AST.NullLiteral, env: VariableEnv): void {
    this.result.write('VALUE_NULL')
  }

  stringLiteral(node: AST.StringLiteral, env: VariableEnv): void {
    this.result.write(`gc_new_string(${JSON.stringify(node.value)})`)
  }

  booleanLiteral(node: AST.BooleanLiteral, env: VariableEnv): void {
    this.result.write(node.value ? 'VALUE_TRUE' : 'VALUE_FALSE')
  }

  numericLiteral(node: AST.NumericLiteral, env: VariableEnv): void {
    const literal = node.extra?.raw as string
    this.result.write(literal)
  }

  identifier(node: AST.Identifier, env: VariableEnv): void {
    const info = env.table.lookup(node.name)
    if (info !== undefined) {
      if (info.isFunction)
        this.result.write(`${info.transpile(node.name)}.${cr.functionPtr}`)
      else
        this.result.write(info.transpile(node.name))
    }
  }

  whileStatement(node: AST.WhileStatement, env: VariableEnv): void {
    this.result.nl()
    this.result.write('while (')
    this.testExpression(node.test, env)
    this.result.write(') ')
    if (node.body.type === 'BlockStatement')
      this.visit(node.body, env)
    else {
      this.result.right()
      this.visit(node.body, env)
      this.result.left()
    }

    this.endWithReturn = false
  }

  testExpression(test: AST.Node, env: VariableEnv) {
    const test_type = this.needsCoercion(test)
    if (test_type !== undefined && !isPrimitiveType(test_type)) {
      this.result.write(`${cr.convertToCondition}(`)
      this.visit(test, env)
      this.result.write(')')
    }
    else
      this.visit(test, env)
  }

  ifStatement(node: AST.IfStatement, env: VariableEnv): void {
    this.result.nl()
    this.result.write('if (')
    this.testExpression(node.test, env)
    this.result.write(') ')
    this.endWithReturn = false
    if (node.consequent.type === 'BlockStatement')
      this.visit(node.consequent, env)
    else {
      this.result.right()
      this.visit(node.consequent, env)
      this.result.left()
    }

    const thenEndsWithReturn = this.endWithReturn
    this.endWithReturn = false
    if (node.alternate) {
      this.result.nl()
      this.result.write('else ')
      if (node.alternate.type === 'BlockStatement')
        this.visit(node.alternate, env)
      else {
        this.result.right()
        this.visit(node.alternate, env)
        this.result.left()
      }
    }

    this.endWithReturn &&= thenEndsWithReturn
  }

  forStatement(node: AST.ForStatement, env: VariableEnv): void {
    const env2 = new VariableEnv(getVariableNameTable(node), env)
    const num = env2.allocateRootSet()
    this.result.nl()
    this.result.write('for (')
    if (node.init)
      this.visit(node.init, env2)

    if (!node.init || AST.isExpression(node.init))
      this.result.write('; ')

    if (node.test)
      this.testExpression(node.test, env2)

    this.result.write('; ')
    if (node.update)
      this.visit(node.update, env2)

    this.result.write(') ')
    if (node.body.type === 'BlockStatement')
      this.visit(node.body, env2)
    else {
      this.result.right()
      this.visit(node.body, env2)
      this.result.left()
    }

    env2.deallocate(num)
    this.endWithReturn = false
  }

  expressionStatement(node: AST.ExpressionStatement, env: VariableEnv): void {
    this.result.nl()
    this.visit(node.expression, env)
    this.result.write(';')
    this.endWithReturn = false
  }

  blockStatement(node: AST.BlockStatement, env: VariableEnv): void {
    const env2 = new VariableEnv(getVariableNameTable(node), env)
    const num = env2.allocateRootSet()
    this.result.write('{')
    this.result.right()
    this.endWithReturn = false
    for (const child of node.body)
      this.visit(child, env2);

    this.result.left()
    this.result.nl()
    this.result.write('}')
    env2.deallocate(num)
  }

  returnStatement(node: AST.ReturnStatement, env: VariableEnv): void {
    this.result.nl()
    if (node.argument) {
      const retType = env.returnType()
      if (retType !== null && retType !== undefined) {
        const typeAndVar = cr.typeToCType(retType, cr.returnValueVariable)
        const type = this.needsCoercion(node.argument)
        if (type)
          this.result.write(`{ ${typeAndVar} = ${cr.typeConversion(type, retType)}(`)
        else
          this.result.write(`{ ${typeAndVar} = (`)

        this.visit(node.argument, env)
        this.result.write(`); ${cr.deleteRootSet}; return ${cr.returnValueVariable}; }`)
      }
      else
        throw this.errorLog.push('returns unknown type', node)
    }
    else
      this.result.write(`{ ${cr.deleteRootSet}; return; }`)

    this.endWithReturn = true
  }

  emptyStatement(node: AST.EmptyStatement, env: VariableEnv): void {
    this.result.nl()
    this.result.write(';')
    this.endWithReturn = false
  }

  breakStatement(node: AST.BreakStatement, env: VariableEnv): void {
    this.result.nl()
    this.result.write('break;')
  }

  continueStatement(node: AST.ContinueStatement, env: VariableEnv): void {
    this.result.nl()
    this.result.write('continue;')
  }

  variableDeclaration(node: AST.VariableDeclaration, env: VariableEnv): void {
    let sig: string | undefined = undefined
    if (env instanceof GlobalEnv)
      sig = ''

    let isFirst = true
    let thisType: StaticType = Void
    for (const decl of node.declarations) {
      const varName = (decl.id as AST.Identifier).name
      const info = env.table.lookup(varName)
      if (info !== undefined) {
        const typeName = cr.typeToCType(info.type)
        if (isFirst || sameType(thisType, info.type)) {
          sig = this.varDeclarator(info, isFirst, varName, sig)
          if (isFirst) {
            isFirst = false
            thisType = info.type
          }

          if (decl.init) {
            const initType = this.needsCoercion(decl.init)
            if (initType) {
              this.result.write(` = ${cr.typeConversion(initType, info.type)}(`)
              this.visit(decl.init, env)
              this.result.write(')')
            }
            else {
              this.result.write(' = ')
              this.visit(decl.init, env)
            }
          }
          else
            this.result.write(' = 0')   // even when the type is float
        }
        else {
          // A declaration with more than one function-type variable is also an error.
          this.errorLog.push('mixed-type declaration is not supported', node)
          break
        }
      }
    }

    if (sig !== undefined && sig !== '')
      this.signatures += sig + ';\n'

    this.result.write(';')
    this.endWithReturn = false
  }

  // If signature is not undefined, this is a top-level declaration.
  // A declaration is separated from its initialization.
  private varDeclarator(info: VariableInfo, isFirst: boolean,
                        varName: string, signature: string | undefined) {
    if (isPrimitiveType(info.type)) {
      const name = info.transpiledName(varName)
      const typeAndVarName = cr.typeToCType(info.type, name)
      if (isFirst) {
        if (signature === undefined)
          this.result.nl().write(typeAndVarName)
        else {
          this.result.nl().write(name)
          signature += typeAndVarName
        }
      }
      else {
        this.result.write(`, ${name}`)
        if (signature !== undefined)
          signature += `, ${name}`
      }
    }
    else {
      if (isFirst)
        this.result.nl()
      else
        this.result.write(', ')

      this.result.write(info.transpile(varName))
    }
    return signature
  }

  private needsCoercion(node: AST.Node) {
    const coercion = getCoercionFlag(node)
    if (coercion)
      return getStaticType(node)
    else
      return undefined
  }

  variableDeclarator(node: AST.VariableDeclarator, env: VariableEnv): void {
    throw this.errorLog.push('cannot directly visit AST.VariableDeclarator', node)
  }

  /* For this function:
       function foo(n: integer) { return n + 1 }
     This method generates the following C code:
       extern struct _foo {
         int32_t (*fptr)(int32_t);
         const char* sig; } _foo;
       static int32_t fbody_foo(int32_t _n) { ... function body ... }
       struct _foo _foo = { fbody_foo, "..." };

     A function-type value is a pointer to _foo of type struct _foo.
  */
  functionDeclaration(node: AST.FunctionDeclaration, env: VariableEnv): void {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    const funcName = (node.id as AST.Identifier).name
    const funcType = getStaticType(node) as FunctionType;
    const prevResult = this.result
    this.result = this.declarations
    const bodyResult = this.result.copy()
    bodyResult.right()
    fenv.allocateRootSet()

    const funcInfo = env.table.lookup(funcName)
    let sig = this.makeParameterList(funcType, node, fenv, bodyResult)
    const transpiledFuncName = funcInfo ? funcInfo.transpiledName(funcName) : funcName
    let funcHeader = cr.typeToCType(funcType.returnType, 'fbody' + transpiledFuncName)
    this.result.nl().write(`static ${funcHeader}${sig} {`)
    this.result.right()
    const declarations = this.result  // this.result == this.declarations
    this.result = bodyResult

    this.result.nl()
    this.visit(node.body, fenv)

    declarations.nl().write(cr.makeRootSet(fenv.getNumOfVars()))
    declarations.write(this.result.getCode())   // = .write(bodyResult.getCode())
    if (!this.endWithReturn)
      if (funcType.returnType === Void)
        declarations.nl().write(cr.deleteRootSet)
      else
        this.errorLog.push('a non-void function must return a value', node)

    declarations.left().nl().write('}').nl()

    const fname = transpiledFuncName
    if (fenv.isFreeVariable(funcInfo))
      prevResult.nl().write(`${fname}.${cr.functionPtr} = fbody${fname};`).nl()
    else {
      this.signatures += this.makeFunctionStruct(fname, funcType)
      declarations.write(`struct ${fname} ${fname} = { fbody${fname}, "${encodeType(funcType)}" };`).nl()
    }

    this.result = prevResult
  }

  private makeParameterList(funcType: FunctionType, node: AST.FunctionDeclaration,
                            fenv: FunctionEnv, bodyResult: CodeWriter) {
    let sig = '('
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      if (i > 0)
        sig += ', '

      const paramName = (node.params[i] as AST.Identifier).name
      const paramType = funcType.paramTypes[i]
      let info = fenv.table.lookup(paramName)
      if (info !== undefined) {
        const name = info.transpiledName(paramName)
        sig += cr.typeToCType(paramType, name)
        if (info.index !== undefined)
          bodyResult.nl().write(info.transpile(paramName)).write(` = ${name};`)
      }
    }

    return sig + ')'
  }

  private makeFunctionStruct(name: string, type: StaticType) {
    return `extern struct ${name} {
  ${cr.typeToCType(type, cr.functionPtr)};
  const char* sig; } ${name};\n`
  }

  unaryExpression(node: AST.UnaryExpression, env: VariableEnv): void {
    const type = this.needsCoercion(node.argument)
    if (type)
      if (node.operator === '-')
        this.result.write(`${cr.minusAnyValue}(`)
      else if (node.operator === '!') {
        this.result.write('!(')
        this.testExpression(node.argument, env)
        this.result.write(')')
        return
      }
      else if (node.operator === '~')
        this.result.write(`~${cr.typeConversion(type, Integer)}(`)
      else
        this.result.write('(')
    else {
      this.result.write(node.operator)
      this.visit(node.argument, env)
      return
    }

    this.visit(node.argument, env)
    this.result.write(')')
  }

  updateExpression(node: AST.UpdateExpression, env: VariableEnv): void {
    const type = this.needsCoercion(node.argument)
    if (type === Any) {
      this.result.write(`${cr.updateOpForAny(node.prefix, node.operator)}(&`)
      this.visit(node.argument, env)
      this.result.write(')')
    }
    else
      if (node.prefix) {
        this.result.write(node.operator)
        this.visit(node.argument, env)
      }
      else {
        this.visit(node.argument, env)
        this.result.write(node.operator)
      }
  }

  binaryExpression(node: AST.BinaryExpression, env: VariableEnv): void {
    if (node.extra?.parenthesized)
      this.result.write('(')

    const left = node.left
    const right = node.right
    const op = node.operator
    if (op === '==' || op === '!=' || op === '===' || op === '!==')
      this.equalityExpression(op, left, right, env)
    else if (op === '<' || op === '<=' || op === '>' || op === '>='
             || op === '+' || op === '-' || op === '*' || op === '/')
      this.basicBinaryExpression(op, left, right, env)
    else if (op === '|' || op === '^' || op === '&' || op === '%' || op === '<<' || op === '>>') {
      // both left and right are integer or float.
      this.numericBinaryExprssion(op, left, right, env)
    }
    else
      throw this.errorLog.push(`bad binary operator ${op}`, node)

    if (node.extra?.parenthesized)
      this.result.write(')')
  }

  private equalityExpression(op: string, left: AST.Node, right: AST.Node, env: VariableEnv): void {
    let op2: string
    if (op === '===')
      op2 = '=='
    else if (op === '!==')
      op2 = '!='
    else
      op2 = op

    const left_type = this.needsCoercion(left)
    const right_type = this.needsCoercion(right)
    if ((left_type === Boolean || right_type === Boolean)
      // if either left or right operand is boolean, the other is boolean
        || (left_type === Any || right_type === Any)) {
      this.result.write(`${cr.typeConversion(left_type, Any)}(`)
      this.visit(left, env)
      this.result.write(`) ${op2} ${cr.typeConversion(right_type, Any)}(`)
      this.visit(right, env)
      this.result.write(')')
    }
    else
      this.numericBinaryExprssion(op2, left, right, env)
  }

  // +, -, *, /, <, <=, ... for integer, float, or any-type values
  private basicBinaryExpression(op: string, left: AST.Node, right: AST.Node, env: VariableEnv): void {
    const left_type = this.needsCoercion(left)
    const right_type = this.needsCoercion(right)
    if (left_type === Any || right_type === Any) {
      this.result.write(`${cr.arithmeticOpForAny(op)}(${cr.typeConversion(left_type, Any)}(`)
      this.visit(left, env)
      this.result.write(`), ${cr.typeConversion(right_type, Any)}(`)
      this.visit(right, env)
      this.result.write('))')
    }
    else
      this.numericBinaryExprssion(op, left, right, env)
  }

  // binary expression for numeric (integer or float) values
  private numericBinaryExprssion(op: string, left: AST.Node, right: AST.Node, env: VariableEnv) {
    this.visit(left, env)
    this.result.write(` ${op} `)
    this.visit(right, env)
  }

  assignmentExpression(node: AST.AssignmentExpression, env: VariableEnv): void {
    const left = node.left
    const right = node.right
    const left_type = this.needsCoercion(left)
    const right_type = this.needsCoercion(right)
    if (node.extra?.parenthesized)
      this.result.write('(')

    const op = node.operator
    if (op === '=') {
      let func: string
      if (left_type === Any)
        func = cr.typeConversion(right_type, Any)
      else if (right_type === Any)
        func = cr.typeConversion(Any, left_type)
      else
        func = ''

      this.visit(left, env)
      if (func === '') {
        this.result.write(' = ')
        this.visit(right, env)
      }
      else {
        this.result.write(` = ${func}(`)
        this.visit(right, env)
        this.result.write(')')
      }
    }
    else if (op === '+=' || op === '-=' || op === '*=' || op === '/=')
      this.accumulateExpression(left, left_type, op, right, right_type, env)
    else if (op === '|=' || op === '^=' || op === '&=' || op === '%=' || op === '<<=' || op === '>>=') {
      this.visit(left, env)
      this.result.write(op)
      this.visit(right, env)
    }

    if (node.extra?.parenthesized)
      this.result.write('(')
  }

  private accumulateExpression(left: AST.LVal, leftType: StaticType | undefined, op: string,
                               right: AST.Expression, rightType: StaticType | undefined,
                               env: VariableEnv): void {
    if (leftType === Any) {
      this.result.write(`${cr.arithmeticOpForAny(op)}(&(`)
      this.visit(left, env)
      this.result.write(`), ${cr.typeConversion(rightType, Any)}(`)
      this.visit(right, env)
      this.result.write('))')
    }
    else if (rightType === Any) {
      this.visit(left, env)
      this.result.write(op)
      this.result.write(` ${cr.typeConversion(Any, leftType)}(`)
      this.visit(right, env)
      this.result.write(')')
    }
    else {
      this.visit(left, env)
      this.result.write(op)
      this.visit(right, env)
    }
  }

  logicalExpression(node: AST.LogicalExpression, env: VariableEnv): void {
    if (node.extra?.parenthesized)
      this.result.write('(')

    this.testExpression(node.left, env)
    this.result.write(node.operator)
    this.testExpression(node.right, env)
    if (node.extra?.parenthesized)
      this.result.write(')')
  }

  conditionalExpression(node: AST.ConditionalExpression, env: VariableEnv): void {
    if (node.extra?.parenthesized)
      this.result.write('(')

    this.testExpression(node.test, env)
    this.result.write(' ? ')
    this.visit(node.consequent, env)
    this.result.write(' : ')
    this.visit(node.alternate, env)
    if (node.extra?.parenthesized)
      this.result.write(')')
  }

  callExpression(node: AST.CallExpression, env: VariableEnv): void {
    const ftype = getStaticType(node.callee) as FunctionType
    this.visit(node.callee, env);
    this.result.write(`(`)
    let numOfObjectArgs = 0
    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i]
      if (i > 0)
        this.result.write(', ')

      if (!isPrimitiveType(ftype.paramTypes[i])) {
        ++numOfObjectArgs
        const index = env.allocate()
        this.result.write(cr.rootSetVariable(index)).write('=')
      }

      const arg_type = this.needsCoercion(arg)
      if (arg_type === undefined)
        this.visit(arg, env)
      else {
        this.result.write(`${cr.typeConversion(arg_type, ftype.paramTypes[i])}(`)
        this.visit(arg, env)
        this.result.write(')')
      }
    }

    env.deallocate(numOfObjectArgs)
    this.result.write(')')
  }

  arrayExpression(node: AST.ArrayExpression, env: VariableEnv):void {
    this.result.write(`${cr.arrayFromElements}(${node.elements.length}`)
    for (const ele of node.elements)
      if (ele !== null) {
        const type = getStaticType(ele)
        this.result.write(`, ${cr.typeConversion(type, Any)}(`)
        this.visit(ele, env)
        this.result.write(')')
      }
    this.result.write(')')
  }

  memberExpression(node: AST.MemberExpression, env: VariableEnv): void {
    const elementType = getStaticType(node)
    this.result.write(`${cr.typeConversion(Any, elementType)}(*${cr.arrayElementGetter}(`)
    this.visit(node.object, env)
    this.result.write(', ')
    this.visit(node.property, env)
    this.result.write('))')
  }

  tsAsExpression(node: AST.TSAsExpression, env: VariableEnv): void {
    const exprType = getStaticType(node.expression)
    const asType = getStaticType(node)
    this.result.write(`${cr.typeConversion(exprType, asType)}(`)
    this.visit(node.expression, env)
    this.result.write(')')
  }

  tsTypeAnnotation(node: AST.TSTypeAnnotation, env: VariableEnv): void {}

  tsTypeReference(node: AST.TSTypeReference, env: VariableEnv): void {}

  tsNumberKeyword(node: AST.TSNumberKeyword, env: VariableEnv): void {}

  tsVoidKeyword(node: AST.TSVoidKeyword, env: VariableEnv): void {}

  tsBooleanKeyword(node: AST.TSBooleanKeyword, env: VariableEnv): void {}

  tsStringKeyword(node: AST.TSStringKeyword, env: VariableEnv): void {}

  tsObjectKeyword(node: AST.TSObjectKeyword, env: VariableEnv): void {}

  tsAnyKeyword(node: AST.TSAnyKeyword, env: VariableEnv): void {}

  tsNullKeyword(node: AST.TSNullKeyword, env: VariableEnv): void {}

  tsUndefinedKeyword(node: AST.TSUndefinedKeyword, env: VariableEnv): void {}

  tsArrayType(node: AST.TSArrayType, env: VariableEnv) {}

  tsFunctionType(node: AST.TSFunctionType, env: VariableEnv): void {}

  tsTypeAliasDeclaration(node: AST.TSTypeAliasDeclaration, env: VariableEnv): void {}
}
