// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { runBabelParser, ErrorLog, CodeWriter } from '../utils'
import { Integer, BooleanT, Void, Any, ObjectType, FunctionType,
         StaticType, isPrimitiveType, encodeType, sameType, typeToString, ArrayType, objectType,
         StringT } from '../types'
import * as visitor from '../visitor'
import {getCoercionFlag, getStaticType, NameInfo, NameTable, NameTableMaker} from '../names'
import TypeChecker, { typecheck } from '../type-checker'
import { VariableInfo, VariableEnv, GlobalEnv, FunctionEnv, VariableNameTableMaker,
         GlobalVariableNameTable, getVariableNameTable } from './variables'
import * as cr from './c-runtime'
import { InstanceType } from '../classes'
import * as fs from 'fs'

/*
  Transpile BlueScript code.

  codeId: an integer more than zero.  It is used for generating a unique name.
  src: the source code for transpilation.
  gvnt: a name table for global variables.
  importer: a handler for processing an import declaration.  It takes a module name and returns
        a name table.  It may throw an error message of string type or an ErrorLog object.
  moduleId: module identifier.  It must be >= 0 if this code is a module.  Otherwise, it must be -1.
        It is used to generate a unique identifier.
  startLine: the line number for the first line of the given source code.
  header: the code inserted in the generated code by transpilation.  It should be #include directives.
*/
export function transpile(codeId: number, src: string, gvnt?: GlobalVariableNameTable,
                          importer?: (name: string) => GlobalVariableNameTable, moduleId: number = -1,
                          startLine: number = 1, header: string = '') {
  const ast = runBabelParser(src, startLine);
  const maker = new VariableNameTableMaker(moduleId)
  const nameTable = new GlobalVariableNameTable(gvnt)
  typecheck(ast, maker, nameTable, importer)
  const nullEnv = new GlobalEnv(new GlobalVariableNameTable(), cr.globalRootSetName)
  const mainFuncName = `${cr.mainFunctionName}${codeId}_${moduleId < 0 ? '' : moduleId}`
  const generator = new CodeGenerator(mainFuncName, codeId, moduleId)
  generator.visit(ast, nullEnv)   // nullEnv will not be used.
  if (generator.errorLog.hasError())
    throw generator.errorLog
  else
    return { code: generator.getCode(header),
      main: mainFuncName, names: nameTable }
}

export class CodeGenerator extends visitor.NodeVisitor<VariableEnv> {
  errorLog = new ErrorLog()
  protected result =  new CodeWriter()
  protected signatures = ''                   // function prototypes etc.
  protected declarations = new CodeWriter()   // function declarations etc.
  protected endWithReturn = false
  private initializerName: string           // the name of an initializer function
  private globalRootSetName: string         // the rootset name for global variables
  private externalMethods: Map<string, StaticType>
  private uniqueId = 0
  private uniqueIdCounter = 0
  private moduleId = -1

  constructor(initializerName: string, codeId: number, moduleId: number) {
    super()
    this.initializerName = initializerName
    this.globalRootSetName = moduleId < 0 ? `${cr.globalRootSetName}${codeId}` : `${cr.globalRootSetName}${codeId}_${moduleId}`
    this.externalMethods = new Map()
    this.uniqueId = codeId
    this.moduleId = moduleId
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

    this.signatures += cr.externClassDef(objectType)
    this.signatures += '\n'
    const externalRoots: { [key: string]: number } = {}
    env2.forEachExternalVariable((info, name, type, index) => {
      if (name === undefined) {
        // a type name only
        if (type instanceof ObjectType) {
          this.signatures += cr.externClassDef(type)
          if (type instanceof InstanceType)
            this.signatures += cr.externNew(type)
        }
        else
          throw this.errorLog.push('fatal: bad external type', node)
      }
      else if (type === undefined) {
        // a global variable stored in a golobal root set.
        const root = externalRoots[name]
        if (root === undefined)
          externalRoots[name] = index === undefined ? 0 : index   // index must be >= 0
        else if (index !== undefined && index > root)
          externalRoots[name] = index
      }
      else if (type instanceof FunctionType)
        this.signatures += this.makeFunctionStruct(name, type, info.isConst)
      else
        this.signatures += `extern ${cr.typeToCType(type, name)};\n`
    })

    for (const name in externalRoots)
      this.signatures += `extern ${cr.declareRootSet(name, externalRoots[name] + 1)}\n`

    this.externalMethods.forEach((type, name, map) =>
      this.signatures += `${cr.funcTypeToCType(type, name)};\n`
    )

    this.signatures += `void ${this.initializerName}();\n${cr.declareRootSet(this.globalRootSetName, size)}\n`
    const numOfVars = env2.getNumOfVars()
    oldResult.write(`\nvoid ${this.initializerName}() {`)
             .right().nl()
             .write(cr.initRootSet(this.globalRootSetName, size))
             .nl().write(cr.makeRootSet(numOfVars))
             .write(this.result.getCode())
             .nl().write(cr.deleteRootSet(numOfVars))
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
    this.makeStringLiteral(node.value)
  }

  private makeStringLiteral(value: string) {
    this.result.write(`${cr.stringMaker}(${JSON.stringify(value)})`)
  }

  booleanLiteral(node: AST.BooleanLiteral, env: VariableEnv): void {
    this.result.write(node.value ? 'VALUE_TRUE' : 'VALUE_FALSE')
  }

  numericLiteral(node: AST.NumericLiteral, env: VariableEnv): void {
    const literal = node.extra?.raw as string
    this.result.write(literal)
  }

  identifier(node: AST.Identifier, env: VariableEnv): void {
    if (node.name === 'undefined') {
      this.result.write('VALUE_UNDEF')
      return
    }

    const info = env.table.lookup(node.name)
    if (info !== undefined) {
        if (info.isFunction) {
          const vname = info.transpile(node.name)
          this.result.write(this.makeFunctionObject(vname))
        }
        else {
          if (info.isGlobal() && info.type instanceof InstanceType
              && env.table.lookup(info.type.name()) === undefined) {
            // force to declare the class name as an external type if it is not declared
            // in this module.
            throw this.errorLog.push(`fatal: unknown class name: ${info.type.name()}`, node)
          }

          this.result.write(info.transpile(node.name))
        }

        return
    }

    throw this.errorLog.push('fatal:  unknown identifier', node)
  }

  private makeUniqueName() {
    const mid = this.moduleId < 0 ? '' : this.moduleId
    return `fn_${mid}_${this.uniqueId}_${this.uniqueIdCounter++}`
  }

  private makeFunctionObject(name: string, fenv?: FunctionEnv) {
    let obj = 'VALUE_UNDEF'
    if (fenv !== undefined) {
      let args = ''

      const frees = fenv.getFreeVariables()
      frees.forEach((info) => {
        args += `, ${cr.rootSetVariable(info.original().index)}`
      })

      if (frees.length > 0) {
        // all the arguments to gc_make_vector must be reachable
        // from the garbage-collection root.
        obj = `gc_make_vector(${frees.length}${args})`
      }
    }

    return `${cr.functionMaker}(${name}.${cr.functionPtr}, ${name}.${cr.functionSignature}, ${obj})`
  }

  protected identifierAsCallable(node: AST.Identifier, env: VariableEnv): void {
    const info = env.table.lookup(node.name)
    if (info !== undefined) {
        const ftype = cr.funcTypeToCType(info.type)
        if (info.isFunction)
          if (info.isConst)
            this.result.write(`${cr.functionBodyName(info.transpile(node.name))}(0`)
          else
            this.result.write(`((${ftype})${info.transpile(node.name)}.${cr.functionPtr})(0`)
        else {
          const fname = info.transpile(node.name)
          this.result.write(`((${ftype})${cr.functionGet}(${fname}, 0))(${fname}`)
        }

      return
    }

    throw this.errorLog.push('fatal: unknown function name', node)
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
      this.initializeCapturedVars(env2)
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
    this.initializeCapturedVars(env2)
    this.endWithReturn = false
    for (const child of node.body)
      this.visit(child, env2);

    this.result.left()
    this.result.nl()
    this.result.write('}')
    env2.deallocate(num)
  }

  private initializeCapturedVars(env: VariableEnv): void {
      env.forEachBoxed((info, key) => {
        this.result.nl().write(`${info.transpileAccess()} = ${cr.makeBoxedValue(info.type)};`)
      })
  }

  returnStatement(node: AST.ReturnStatement, env: VariableEnv): void {
    this.returnStatementArg(node, node.argument, env)
  }

  protected returnStatementArg(node: AST.Node, argument: AST.Expression | null | undefined, env: VariableEnv): void {
    this.result.nl()
    if (argument) {
      const retType = env.returnType()
      if (retType !== null && retType !== undefined) {
        const typeAndVar = cr.typeToCType(retType, cr.returnValueVariable)
        const type = this.needsCoercion(argument)
        if (type)
          this.result.write(`{ ${typeAndVar} = ${cr.typeConversion(type, retType, node)}`)
        else
          this.result.write(`{ ${typeAndVar} = (`)

        this.visit(argument, env)
        this.result.write(`); ${cr.deleteRootSet(env.getNumOfVars())}; return ${cr.returnValueVariable}; }`)
      }
      else
        throw this.errorLog.push('returns unknown type', node)
    }
    else
      this.result.write(`{ ${cr.deleteRootSet(env.getNumOfVars())}; return; }`)

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

  classDeclaration(node: AST.ClassDeclaration, env: VariableEnv): void {
    if (!node.id)
      throw this.errorLog.push('internal error: class name must be given', node)

    const info = env.table.lookup(node.id.name)
    if (info && info.type instanceof InstanceType) {
      const clazz = info.type
      const table = clazz.makeMethodTable()
      for (let i = 0; i < table.length; i++) {
        if (table[i].clazz !== clazz) {
          const funcName = cr.methodBodyNameInC(table[i].clazz.name(), i)
          this.externalMethods.set(funcName, table[i].type)
        }
      }

      this.declarations.write(cr.classDeclaration(clazz, env.table.classTable())).nl()

      let defaultConstructor = true
      for (const mem of node.body.body) {
        if (AST.isClassMethod(mem))
          if (mem.kind === 'constructor') {
            this.classConstructor(mem, clazz, env)
            defaultConstructor = false
          }
          else
            this.classMethodBody(mem, clazz, env)
      }

      if (defaultConstructor) {
        const superClass = clazz.superType()
        let superCall
        if (superClass instanceof InstanceType)
          superCall = `${cr.constructorNameInC(superClass.name())}(self); `
        else
          superCall = ''

        this.declarations.nl().write(`value_t ${cr.constructorNameInC(clazz.name())}(value_t self) { ${superCall}return self; }`).nl().nl()
      }
    }
  }

  private classConstructor(node: AST.ClassMethod, clazz: InstanceType, env: VariableEnv) {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    fenv.allocateRootSet()
    const funcType = getStaticType(node) as FunctionType;
    const funcName = cr.constructorBodyNameInC(clazz.name())

    const prevResult = this.result
    this.result = this.declarations
    this.functionBody(node, fenv, funcType, funcName)

    const sig = this.makeParameterList(funcType, node, fenv, undefined, true)
    let args = 'self'
    for (let i = 0; i < funcType.paramTypes.length; i++)
      args += `, p${i}`
    this.result.nl().write(`value_t ${cr.constructorNameInC(clazz.name())}${sig} { ${funcName}(${args}); return self; }`).nl().nl()
    this.signatures += `value_t ${cr.constructorNameInC(clazz.name())}${sig};\n`
    this.result = prevResult
  }

  private classMethodBody(node: AST.ClassMethod, clazz: InstanceType, env: VariableEnv) {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    fenv.allocateRootSet()
    const funcType = getStaticType(node) as FunctionType;
    if (!AST.isIdentifier(node.key))
      throw this.errorLog.push('internal error: method name must be an identifier', node)

    const found = clazz.findMethod(node.key.name)
    if (!found)
      throw this.errorLog.push(`internal error: unknown method name: ${node.key.name}`, node)

    const funcName = cr.methodBodyNameInC(clazz.name(), found[1])
    const prevResult = this.result
    this.result = this.declarations
    const funcHeader = this.functionBody(node, fenv, funcType, funcName, '')
    this.signatures += `${funcHeader};\n`
    this.result = prevResult
  }

  classBody(node: AST.ClassBody, env: VariableEnv): void {}
  classProperty(node: AST.ClassProperty, env: VariableEnv): void {}
  classMethod(node: AST.ClassMethod, env: VariableEnv): void {}

  variableDeclaration(node: AST.VariableDeclaration, env: VariableEnv): void {
    if (this.isConstFunctionDeclaration(node, env))
      return

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
          sig = this.varDeclarator(decl, env, info, isFirst, varName, sig)
          if (isFirst) {
            isFirst = false
            thisType = info.type
          }
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
    this.initCapturedVars(node, thisType, env)
    this.endWithReturn = false
  }

  // If signature is not undefined, this is a top-level declaration.
  // A declaration is separated from its initialization.
  private varDeclarator(decl: AST.VariableDeclarator, env: VariableEnv,
                        info: VariableInfo, isFirst: boolean,
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

      if (info.isBoxed() && decl.init) {
        this.result.write(`${cr.setObjectProperty}(${info.transpileAccess()}, 0, `)
        this.declaratorInitializer(decl, false, info, env)
        this.result.write(')')
        return signature
      }
      else if (info.isGlobal() && decl.init) {
        this.result.write(`${cr.setGlobalVariable}(&${info.transpile(varName)}, `)
        this.declaratorInitializer(decl, false, info, env)
        this.result.write(')')
        return signature
      }
      else
        this.result.write(info.transpile(varName))
    }

    this.declaratorInitializer(decl, true, info, env)

    return signature
  }

  private declaratorInitializer(decl: AST.VariableDeclarator, withEq: boolean,
                                 info: VariableInfo, env: VariableEnv) {
    if (decl.init) {
      const initType = this.needsCoercion(decl.init)
      if (initType) {
        const converter = cr.typeConversion(initType, info.type, decl)
        this.result.write(` ${withEq ? '=' : ''} ${converter}`)
        this.visit(decl.init, env)
        this.result.write(')')
      }
      else {
        if (withEq)
          this.result.write(' = ')

        this.visit(decl.init, env)
      }
    }
    else
      this.result.write(' = 0')   // even when the type is float
  }

  private initCapturedVars(node: AST.VariableDeclaration, type: StaticType, env: VariableEnv) {
    for (const decl of node.declarations) {
      const varName = (decl.id as AST.Identifier).name
      const info = env.table.lookup(varName)
      if (info !== undefined && info.captured && isPrimitiveType(info.type))
        this.result.write(` ${info.transpile(varName)} = ${info.transpiledName(varName)};`)
    }
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

  private isConstFunctionDeclaration(node: AST.VariableDeclaration, env: VariableEnv): boolean {
    if (node.kind === 'const' && node.declarations.length === 1 && env.table.isGlobal()) {
      const decl = node.declarations[0]
      if (decl.init && AST.isArrowFunctionExpression(decl.init)) {
        const func = decl.init
        const funcName = (decl.id as AST.Identifier).name
        this.functionBodyDeclaration(func, funcName, env, false)
        return true
      }
    }

    return false
  }

  functionDeclaration(node: AST.FunctionDeclaration, env: VariableEnv): void {
    const funcName = (node.id as AST.Identifier).name
    this.functionBodyDeclaration(node, funcName, env)
  }

  /* For this function:
        function foo(n: integer) { return n + 1 }
     This method generates the following C code:
        extern struct func_body _foo;
        static int32_t fbody_foo(value_t self, int32_t _n) { ... function body ... }
        struct func_body _foo = { fbody_foo, "(i)i" };

      fbody_foo() will be a non-static function if isStatic is false.
  */
  functionBodyDeclaration(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression,
                          funcName: string, env: VariableEnv, isStatic: boolean = true): FunctionEnv {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    fenv.allocateRootSet()
    const funcType = getStaticType(node) as FunctionType;
    const funcInfo = env.table.lookup(funcName)
    const transpiledFuncName = funcInfo ? funcInfo.transpiledName(funcName) : funcName
    const bodyName = cr.functionBodyName(transpiledFuncName)

    const prevResult = this.result
    this.result = this.declarations
    if (isStatic)
      this.functionBody(node, fenv, funcType, bodyName)
    else
      this.functionBody(node, fenv, funcType, bodyName, '')   // not a static function

    this.result = prevResult

    const fname = transpiledFuncName
    if (fenv.isFreeVariable(funcInfo))
      this.result.nl().write(`${fname}.${cr.functionPtr} = ${bodyName};`).nl()
    else {
      this.signatures += this.makeFunctionStruct(fname, funcType, false)
      this.declarations.write(`${cr.funcStructInC} ${fname} = { ${bodyName}, "${encodeType(funcType)}" };`).nl()
    }

    return fenv
  }

  /* For this function:
        function foo(n: integer) { return n + 1 }
     this method generates the following C code:
        static int32_t ${bodyName}(value_t self, int32_t _n) { ... function body ... }
  */
  protected functionBody(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression | AST.ClassMethod,
                       fenv: FunctionEnv, funcType: FunctionType, bodyName: string,
                       modifier: string = 'static ') {
    const bodyResult = this.result.copy()
    bodyResult.right()
    const sig = this.makeParameterList(funcType, node, fenv, bodyResult)

    const declarations = this.result
    this.result = bodyResult

    this.result.nl()
    if (AST.isExpression(node.body))
      this.returnStatementArg(node, node.body, fenv)
    else
      this.visit(node.body, fenv)

    const bodyCode = this.result.getCode()
    this.result = declarations

    const funcHeader = `${modifier}${cr.typeToCType(funcType.returnType, bodyName)}${sig}`
    this.result.nl().write(funcHeader).write(' {')
    this.result.right()
    const numOfVars = fenv.getNumOfVars()
    this.result.nl().write(cr.makeRootSet(numOfVars))
    this.result.write(bodyCode)
    if (!this.endWithReturn)
      if (funcType.returnType === Void)
        this.result.nl().write(cr.deleteRootSet(numOfVars))
      else
        this.errorLog.push('a non-void function must return a value', node)

    this.result.left().nl().write('}').nl()
    return funcHeader
  }

  protected makeParameterList(funcType: FunctionType, node: AST.FunctionDeclaration | AST.ArrowFunctionExpression | AST.ClassMethod,
                              fenv: FunctionEnv, bodyResult?: CodeWriter, simpleName: boolean = false) {
    let sig = `(${cr.anyTypeInC} self`
    const bodyResult2 = bodyResult?.copy()

    const thisInfo = fenv.table.lookupInThis('this')
    if (thisInfo !== undefined && !fenv.isFreeVariable(thisInfo)) {  // when "this" is a free variable, the node is not a method or a constructor.
      const transpiledParam = thisInfo.transpileAccess()
      bodyResult?.nl().write(`${transpiledParam} = self;`)
      if (thisInfo.isBoxed())
        bodyResult2?.nl().write(`${transpiledParam} = ${cr.makeBoxedValue(thisInfo.type, transpiledParam)};`)
    }
    else {
      const index = fenv.allocate()
      const selfVar = cr.rootSetVariable(index)
      bodyResult?.nl().write(`${selfVar} = self;`)
    }

    for (let i = 0; i < funcType.paramTypes.length; i++) {
      sig += ', '

      const paramName = (node.params[i] as AST.Identifier).name
      const paramType = funcType.paramTypes[i]
      const info = fenv.table.lookup(paramName)
      if (info !== undefined) {
        const name = simpleName ? `p${i}` : info.transpiledName(paramName)
        sig += cr.typeToCType(paramType, name)
        if (info.index !== undefined) {
          if (isPrimitiveType(info.type)) {
            if (info.isBoxed())
              bodyResult2?.write(`${info.transpileAccess()} = ${cr.makeBoxedValue(info.type, name)};`)
          }
          else {
            // Sincee making a box may cause garbage collection, all references must be stored
            // in a root set before making a box.
            const transpiledParam = info.transpileAccess()
            bodyResult?.nl().write(`${transpiledParam} = ${name};`)
            if (info.isBoxed())
              bodyResult2?.nl().write(`${transpiledParam} = ${cr.makeBoxedValue(info.type, transpiledParam)};`)
          }
        }
      }
    }

    if (bodyResult2)
      bodyResult?.write(bodyResult2.getCode())

    const freeVars = fenv.getFreeVariables()
    freeVars.forEach((info, index) => {
      const value = `${cr.functionGetCapturedValue}(self, ${index})`
      bodyResult?.nl().write(`${info.transpileAccess()} = ${value};`)
    })

    return sig + ')'
  }

  protected makeSimpleParameterList(funcType: FunctionType) {
    let sig = `(${cr.anyTypeInC} self`
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      sig += `, ${cr.typeToCType(funcType.paramTypes[i], `p${i}`)}`
    }

    return sig + ')'
  }

  protected makeFunctionStruct(name: string, type: FunctionType, isConst: boolean) {
    let body: string = ''
    if (isConst) {
      const bodyName = cr.functionBodyName(name)
      const sig = this.makeSimpleParameterList(type)
      body = `extern ${cr.typeToCType(type.returnType, bodyName)}${sig};\n`
    }

    return `extern ${cr.funcStructInC} ${name};\n${body}`
  }

  arrowFunctionExpression(node: AST.ArrowFunctionExpression, env: VariableEnv): void {
    const name = this.makeUniqueName()
    const fenv = this.functionBodyDeclaration(node, name, env)
    this.result.write(this.makeFunctionObject(name, fenv))
  }

  unaryExpression(node: AST.UnaryExpression, env: VariableEnv): void {
    if (node.operator === 'typeof') {
      const t = getStaticType(node.argument)
      this.makeStringLiteral(t === undefined ? '??' : typeToString(t))
      return
    }

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
        this.result.write(`~${cr.typeConversion(type, Integer, node)}`)
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
    // This method assumes that a variable or a property holds a primitive value such as an integer even if
    // its type is Any.  So this method does not insert a write barrier.
    // Also see accumulateExpression().

    const arg = node.argument
    const argType = this.needsCoercion(arg)

    if (AST.isMemberExpression(arg)) {
      // if left is a member expression, left_type is not undefined.
      if (argType && !isPrimitiveType(argType)) {
        const op = cr.updateOperator(node.operator, node.prefix)
        this.anyMemberAccumulateExpression(arg, undefined, undefined, op, env)
        return
      }
    }
    else {
      const info = this.isAssignmentToVar(arg, env)
      if (info !== undefined && info.isBoxed()) {
        this.updateExpr(node, argType, env, () => {
          this.result.write(info.transpileBoxed(false))
        })
        return
      }
    }

    this.updateExpr(node, argType, env, () => this.visit(node.argument, env))
  }

  updateExpr(node: AST.UpdateExpression, argType: StaticType | undefined, env: VariableEnv,
             writeLval: () => void) {
    if (argType === Any) {
      this.result.write(`${cr.updateOpForAny(node.prefix, node.operator)}(&`)
      writeLval()
      this.result.write(')')
    }
    else
      if (node.prefix) {
        this.result.write(node.operator)
        writeLval()
      }
      else {
        this.result.write('(')
        writeLval()
        this.result.write(`)${node.operator}`)
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
             || op === '+' || op === '-' || op === '*' || op === '/' || op === '%' || op === '**')
      this.basicBinaryExpression(op, node, left, right, env)
    else if (op === '|' || op === '^' || op === '&' || op === '<<' || op === '>>') {
      // both left and right are integer or float.
      this.numericBinaryExprssion(op, left, right, env)
    }
    else if (op === '>>>') {
      // both left and right are integer or float.
      this.unsignedRightShift(left, right, env)
    }
    else if (op === 'instanceof')
      this.instanceOfExpression(left, right, env)
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
    if ((left_type === BooleanT || right_type === BooleanT)
      // if either left or right operand is boolean, the other is boolean
        || (left_type === Any || right_type === Any)) {
      this.result.write(`${cr.typeConversion(left_type, Any, left)}`)
      this.visit(left, env)
      this.result.write(`) ${op2} ${cr.typeConversion(right_type, Any, right)}`)
      this.visit(right, env)
      this.result.write(')')
    }
    else
      this.numericBinaryExprssion(op2, left, right, env)
  }

  // +, -, *, /, %, <, <=, ... for integer, float, or any-type values
  private basicBinaryExpression(op: string, node: AST.BinaryExpression, left: AST.Node, right: AST.Node, env: VariableEnv): void {
    const left_type = this.needsCoercion(left)
    const right_type = this.needsCoercion(right)
    if (left_type === Any || right_type === Any) {
      this.result.write(`${cr.arithmeticOpForAny(op)}(${cr.typeConversion(left_type, Any, left)}`)
      this.visit(left, env)
      this.result.write(`), ${cr.typeConversion(right_type, Any, right)}`)
      this.visit(right, env)
      this.result.write('))')
    }
    else
      if (op === '**') {
        this.result.write(cr.power(getStaticType(node)))
        this.visit(left, env)
        this.result.write(', ')
        this.visit(right, env)
        this.result.write(')')
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

  private unsignedRightShift(left: AST.Node, right: AST.Node, env: VariableEnv) {
    this.result.write(`(${cr.uint32type})(`)
    this.visit(left, env)
    this.result.write(') >> ')
    this.visit(right, env)
  }

  private instanceOfExpression(left: AST.Node, right: AST.Node, env: VariableEnv) {
    const type = getStaticType(right)
    if (type === StringT)
      this.result.write(cr.isStringType)
    else if (type instanceof InstanceType)
      this.result.write(cr.isInstanceOf(type))
    else
      throw this.errorLog.push('fatal: bad instanceof', right)

    this.visit(left, env)
    this.result.write(')')
  }

  assignmentExpression(node: AST.AssignmentExpression, env: VariableEnv): void {
    if (node.extra?.parenthesized)
      this.result.write('(')

    const op = node.operator
    if (op === '=')
      this.simpleAssignment(node, env)
    else if (op === '+=' || op === '-=' || op === '*=' || op === '/=')
      this.accumulateExpression(node, op, env)
    else if (op === '|=' || op === '^=' || op === '&=' || op === '%=' || op === '<<=' || op === '>>=') {
      // left and right operands are Integer.  See assignmentExpression() in TypeChecker<>.
      this.accumulateExpression(node, op, env)
    }

    if (node.extra?.parenthesized)
      this.result.write('(')
  }

  private simpleAssignment(node: AST.AssignmentExpression, env: VariableEnv) {
    const left = node.left
    const right = node.right
    const leftType = this.needsCoercion(left)
    const rightType = this.needsCoercion(right)

    if (AST.isMemberExpression(left)) {
      // if left is a member expression, left_type is not undefined.
      if (leftType && !isPrimitiveType(leftType)) {
        this.anyMemberAssignmentExpression(left, leftType, right, rightType, env)
        return
      }
    }
    else {
      const info = this.isAssignmentToVar(left, env)
      if (info !== undefined)
        if (info.isBoxed()) {
          const lval = info.transpileBoxed(false, true)
          if (isPrimitiveType(info.type)) {
            this.result.write(`${lval} = `)
            this.assignmentRight(leftType, right, rightType, env)
          }
          else {
            this.result.write(lval)
            this.assignmentRight(leftType, right, rightType, env)
            this.result.write(')')
          }
          return
        }
        else if (info.isGlobal() && !isPrimitiveType(info.type)) {
          this.result.write(`${cr.setGlobalVariable}(&`)
          this.visit(left, env)
          this.result.write(', ')
          this.assignmentRight(leftType, right, rightType, env)
          this.result.write(')')
          return
        }
    }

    this.visit(left, env)
    this.result.write(' = ')
    this.assignmentRight(leftType, right, rightType, env)
  }

  private isAssignmentToVar(left: AST.Node, env: VariableEnv) {
    if (AST.isIdentifier(left))
      return env.table.lookup(left.name)
    else
      return undefined
  }

  // Assign a value to a member of ANY or unknown type.
  private anyMemberAssignmentExpression(leftNode: AST.MemberExpression, leftType: StaticType | undefined,
                                        rightNode: AST.Node, rightType: StaticType | undefined,
                                        env: VariableEnv) {
    let nvars = 0     // number of variables
    if (leftNode.computed) {
      // an array access like a[b]
      this.result.write(cr.arrayElementSetter(getStaticType(leftNode.object)))
      this.visit(leftNode.object, env)
      this.result.write(', ')
      nvars = this.callExpressionArg(leftNode.property, Integer, env)
    }
    else {
      // a member access like a.b
      const propertyName = (leftNode.property as AST.Identifier).name
      const objType = getStaticType(leftNode.object)
      if (objType instanceof InstanceType) {
        const typeAndIndex = this.getPropertyIndex(objType, propertyName, leftNode)

        // the resulting type of assignment is always ANY
        this.result.write(`${cr.setObjectProperty}(`)
        this.visit(leftNode.object, env)
        this.result.write(`, ${typeAndIndex[1]}`)
      }
      else if (objType === Any || objType === undefined) {
        const propertyCode = this.getPropertyCode(propertyName, leftNode, env)
        this.result.write(`${cr.setAnyObjectProperty}(`)
        this.visit(leftNode.object, env)
        this.result.write(`, ${propertyCode}`)
      }
      else
        throw this.errorLog.push(`fatal: unknown member name: ${propertyName}`, leftNode)
    }

    this.result.write(', ')
    this.assignmentRight(leftType, rightNode, rightType, env)
    this.result.write(')')
    env.deallocate(nvars)
  }

  private assignmentRight(left_type: StaticType | undefined,
                          right: AST.Node, right_type: StaticType | undefined,
                          env: VariableEnv) {
    let func: string
    if (left_type === Any || right_type === Any)
      func = cr.typeConversion(right_type, left_type, right)
    else
      func = '('

    if (func === '(')
      this.visit(right, env)
    else {
      this.result.write(func)
      this.visit(right, env)
      this.result.write(')')
    }
  }

  private accumulateExpression(node: AST.AssignmentExpression, op: string, env: VariableEnv) {
    // This method assumes that a variable or a property holds a primitive value such as an integer even if
    // its type is Any.  So this method does not insert a write barrier.
    // When string_array += string is supported, `gc_array_set` must be used for string accumulation.
    // Also see this.updateExpression().

    const left = node.left
    const right = node.right
    const leftType = this.needsCoercion(left)
    const rightType = this.needsCoercion(right)

    if (AST.isMemberExpression(left)) {
      // if left is a member expression, left_type is not undefined.
      if (leftType && !isPrimitiveType(leftType)) {
        this.anyMemberAccumulateExpression(left, right, rightType, op, env)
        return
      }
    }
    else {
      const info = this.isAssignmentToVar(left, env)
      if (info !== undefined && info.isBoxed()) {
        this.accumulateExpr(node, leftType, rightType, env, () => {
          this.result.write(info.transpileBoxed(false))
        })
        return
      }
    }

    this.accumulateExpr(node, leftType, rightType, env, () => this.visit(left, env))
  }

  private accumulateExpr(node: AST.AssignmentExpression, leftType: StaticType | undefined,
                         rightType: StaticType | undefined, env: VariableEnv,
                         writeLval: () => void) {
    const op = node.operator
    if (leftType === Any) {
      this.result.write(`${cr.arithmeticOpForAny(op)}(&(`)
      writeLval()
      this.result.write(`), `)
      this.assignmentRight(leftType, node.right, rightType, env)
      this.result.write(')')
    }
    else {
      writeLval()
      this.result.write(` ${op} `)
      this.assignmentRight(leftType, node.right, rightType, env)
    }
  }

  // A member type is Any or unknown.
  private anyMemberAccumulateExpression(leftNode: AST.MemberExpression,
                                        rightNode: AST.Node | undefined, rightType: StaticType | undefined,
                                        op: string, env: VariableEnv) {
    let nvars = 0     // number of variables
    if (leftNode.computed) {
      // an array access like a[b]
      this.result.write(`${cr.accumulateInUnknownArray}(`)
      this.visit(leftNode.object, env)
      this.result.write(', ')
      nvars = this.callExpressionArg(leftNode.property, Integer, env)
      this.result.write(`, '${op[0]}'`)
    }
    else {
      // a member access like a.b
      const propertyName = (leftNode.property as AST.Identifier).name
      const objType = getStaticType(leftNode.object)
      if (objType instanceof InstanceType) {
        const typeAndIndex = this.getPropertyIndex(objType, propertyName, leftNode)

        // the resulting type of assignment is always ANY
        this.result.write(`${cr.arithmeticOpForAny(op)}(`)
        this.result.write(`${cr.getObjectPropertyAddress}(`)
        this.visit(leftNode.object, env)
        this.result.write(`, ${typeAndIndex[1]})`)
        if (rightNode === undefined) {
          this.result.write(')')
          return
        }
      }
      else if (objType === Any || objType === undefined) {
        const propertyCode = this.getPropertyCode(propertyName, leftNode, env)
        this.result.write(`${cr.accmulateInUnknownMember}(`)
        this.visit(leftNode.object, env)
        this.result.write(`, '${op[0]}', ${propertyCode}`)
      }
      else
        throw this.errorLog.push(`fatal: unknown member name: ${propertyName}`, leftNode)
    }

    if (rightNode === undefined)
      this.result.write(', 0)')
    else {
      this.result.write(', ')
      this.assignmentRight(Any, rightNode, rightType, env)
      this.result.write(')')
    }
    env.deallocate(nvars)
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
    let numOfObjectArgs = 0
    let calleeIsIdentifier
    if (AST.isIdentifier(node.callee)) {
      calleeIsIdentifier = true
      this.identifierAsCallable(node.callee, env)
    }
    else if (AST.isSuper(node.callee)) {
      calleeIsIdentifier = true
      this.superConstructorCall(node.callee, env)
    }
    else {
      calleeIsIdentifier = false
      numOfObjectArgs += 1
      const index = env.allocate()
      const func = cr.rootSetVariable(index)
      this.result.write(`(${func} = `)
      const method = AST.isMemberExpression(node.callee) && this.visitIfMethodExpr(node.callee, env)
      if (method) {
        if (method[1]) {
          // a method call on super
          const funcType = method[0][0]
          const index = method[0][1]
          const clazz = method[0][2]
          const funcName = cr.methodBodyNameInC(clazz.name(), index)
          this.externalMethods.set(funcName, funcType)
          this.result.write(`, ${funcName}(${func}`)
        }
        else
          this.result.write(`, ${cr.methodLookup(method[0], func)}(${func}`)
      }
      else {
        // the callee is an expression resulting in a function object.
        this.visit(node.callee, env)
        this.result.write(`, ((${cr.funcTypeToCType(ftype)})${cr.functionGet}(${func}, 0))(${func}`)
      }
    }

    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i]
      this.result.write(', ')
      numOfObjectArgs += this.callExpressionArg(arg, ftype.paramTypes[i], env)
    }

    env.deallocate(numOfObjectArgs)
    this.result.write(calleeIsIdentifier ? ')' : '))')
  }

  private superConstructorCall(node: AST.Super, env: VariableEnv) {
    const type = env.table.lookup('this')?.type
    if (type instanceof InstanceType) {
      const t = type.superclass()
      this.result.write(`${cr.constructorNameInC(t.name())}(self`)
    }
    else
      throw this.errorLog.push('fatal: unknown super class', node)
  }

  private callExpressionArg(arg: AST.Node, type: StaticType, env: VariableEnv) {
    const n = this.addToRootSet(arg, type, env)
    const arg_type = this.needsCoercion(arg)
    if (arg_type === undefined)
      this.visit(arg, env)
    else {
      this.result.write(cr.typeConversion(arg_type, type, arg))
      this.visit(arg, env)
      this.result.write(')')
    }

    return n
  }

  private addToRootSet(arg: AST.Node, type: StaticType, env: VariableEnv) {
    if (isPrimitiveType(type) || AST.isIdentifier(arg))
      return 0
    else {
      const index = env.allocate()
      this.result.write(cr.rootSetVariable(index)).write('=')
      return 1
    }
  }

  newExpression(node: AST.NewExpression, env: VariableEnv): void {
    const type = getStaticType(node)
    if (type instanceof ArrayType)
      this.newArrayExpression(node, type, env)
    else if (type instanceof InstanceType)
      this.newObjectExpression(node, type, env)
    else
      throw this.errorLog.push(`bad new expression`, node)
  }

  newArrayExpression(node: AST.NewExpression, atype: ArrayType, env: VariableEnv): void {
    this.result.write(cr.arrayFromSize(atype.elementType))
    let numOfObjectArgs = this.callExpressionArg(node.arguments[0], Integer, env)

    this.result.write(', ')
    if (node.arguments.length === 1)
      if (atype.elementType === Any)
        this.result.write('VALUE_UNDEF')
      else
        this.result.write('0')    // only Integer, Float, or Boolean
    else if (node.arguments.length === 2)
        numOfObjectArgs += this.callExpressionArg(node.arguments[1], atype.elementType, env)

    env.deallocate(numOfObjectArgs)
    this.result.write(')')
  }

  newObjectExpression(node: AST.NewExpression, clazz: InstanceType, env: VariableEnv): void {
    this.result.write(cr.makeInstance(clazz))
    const cons = clazz.findConstructor()
    if (cons !== undefined) {
      const params = cons.paramTypes
      let numOfObjectArgs = 0
      for (let i = 0; i < node.arguments.length; i++) {
        this.result.write(', ')
        numOfObjectArgs += this.callExpressionArg(node.arguments[i], params[i], env)
      }

      env.deallocate(numOfObjectArgs)
    }

    this.result.write(')')
  }

  thisExpression(node: AST.ThisExpression, env: VariableEnv): void {
    this.result.write('self')
  }

  superExpression(node: AST.Super, env: VariableEnv): void {
    this.result.write('self')
  }

  arrayExpression(node: AST.ArrayExpression, env: VariableEnv):void {
    const atype = getStaticType(node)
    if (!(atype instanceof ArrayType))
      throw this.errorLog.push(`bad array expression`, node)

    this.result.write(cr.arrayFromElements(atype.elementType) + node.elements.length)
    let numOfObjectArgs = 0
    for (const ele of node.elements)
      if (ele !== null) {
        this.result.write(', ')
        numOfObjectArgs += this.addToRootSet(ele, atype.elementType, env)
        const type = getStaticType(ele)
        this.result.write(cr.typeConversion(type, atype.elementType, ele))
        this.visit(ele, env)
        this.result.write(')')
      }

    env.deallocate(numOfObjectArgs)
    this.result.write(')')
  }

  memberExpression(node: AST.MemberExpression, env: VariableEnv): void {
    if (node.computed) {
      // an array access like a[b]
      const arrayType = getStaticType(node.object)
      const elementType = getStaticType(node)
      this.result.write(cr.arrayElementGetter(elementType, arrayType, node))
      this.visit(node.object, env)
      this.result.write(', ')
      const n = this.callExpressionArg(node.property, Integer, env)
      this.result.write('))')
      env.deallocate(n)   // n will be zero.
    }
    else {
      // a member access like a.b
      const objType = getStaticType(node.object)
      const propertyName = (node.property as AST.Identifier).name
      if (objType instanceof InstanceType) {
        const typeAndIndex = this.getPropertyIndex(objType, propertyName, node)
        const unbox = objType.unboxedProperties()
        if (unbox && typeAndIndex[1] < unbox) {
          this.result.write(cr.getObjectPrimitiveProperty(typeAndIndex[0]))
          this.visit(node.object, env)
          this.result.write(`, ${typeAndIndex[1]})`)
        }
        else {
          this.result.write(`${cr.typeConversion(Any, typeAndIndex[0], node)}${cr.getObjectProperty}(`)
          this.visit(node.object, env)
          this.result.write(`, ${typeAndIndex[1]}))`)
        }
      }
      else if (objType instanceof ArrayType && propertyName === ArrayType.lengthMethod) {
        this.result.write(cr.getObjectPrimitiveProperty(Integer))
        this.visit(node.object, env)
        this.result.write(`, ${cr.getArrayLengthIndex(objType.elementType)})`)
      }
      else if (objType === Any) {
        const propertyCode = this.getPropertyCode(propertyName, node, env)
        this.result.write(`${cr.getAnyObjectProperty(propertyName)}(`)
        this.visit(node.object, env)
        this.result.write(`, ${propertyCode})`)
      }
      else
        throw this.errorLog.push('fatal: unknown array property', node)
    }
  }

  // This returns [[method_type, method_table_index, declaring_class], is_call_on_super?] or undefined.
  visitIfMethodExpr(node: AST.MemberExpression, env: VariableEnv): [[StaticType, number, InstanceType], boolean] | undefined {
    if (node.computed)
      return undefined

    if (!AST.isIdentifier(node.property))
      return undefined

    const propertyName = node.property.name
    const receiverType = getStaticType(node.object)
    if (receiverType instanceof InstanceType) {
      const mth = receiverType.findMethod(propertyName)
      if (mth) {
        this.visit(node.object, env)
        return [mth, AST.isSuper(node.object)]
      }
    }

    return undefined
  }

  private getPropertyIndex(objType: InstanceType, propertyName: string,
                           node: AST.Node) {
    const typeAndIndex  = objType.findProperty(propertyName)
    if (typeAndIndex)
      return typeAndIndex
    else
      throw this.errorLog.push('fatal: unknown member name', node)
  }

  private getPropertyCode(propertyName: string, node: AST.Node, env: VariableEnv) {
    const propertyCode = env.table.classTable().encodeName(propertyName)
    if (propertyCode === undefined)
      throw this.errorLog.push(`no class declares such a member: ${propertyName}`, node)
    else
      return propertyCode
  }

  taggedTemplateExpression(node: AST.TaggedTemplateExpression, env: VariableEnv): void {
    // embedded native C code
    const src = node.quasi.quasis[0].value.raw
    if (env instanceof GlobalEnv)
      this.signatures += `${src}\n`
    else
      this.result.write(src)
  }

  tsAsExpression(node: AST.TSAsExpression, env: VariableEnv): void {
    const exprType = getStaticType(node.expression)
    const asType = getStaticType(node)
    this.result.write(`${cr.typeConversion(exprType, asType, node)}`)
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

  exportNamedDeclaration(node: AST.ExportNamedDeclaration, env: VariableEnv) {
    if (node.declaration != undefined)
      this.visit(node.declaration, env);
  }
}
