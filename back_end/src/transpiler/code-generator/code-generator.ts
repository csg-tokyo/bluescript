import * as AST from '@babel/types'
import { runBabelParser, ErrorLog } from '../utils'
import {
  Integer, Float, Boolean, String, Void, Null, Any,
  ObjectType, FunctionType,
  StaticType, isPrimitiveType, } from '../types'
import * as visitor from '../visitor'
import { GlobalNameTable,
         getCoercionFlag, getStaticType } from '../type-checker/names'
import { typecheck } from '../type-checker/type-checker'
import { CodeWriter, VariableInfo, VariableEnv, FunctionEnv, VariableTableMaker,
         getVariableTable, rootSetVariable} from './variables'

export function transpile(src: string, startLine: number = 1) {
  const ast = runBabelParser(src, startLine);
  const maker = new VariableTableMaker()
  const nameTable = new GlobalNameTable<VariableInfo>()
  typecheck(ast, maker, nameTable)
  const env = new VariableEnv(nameTable, null)
  const generator = new CodeGenerator()
  generator.visit(ast, env)
  return generator.result.getCode()
}

// variables.ts also includes some functions where the names of C functions
// are embedded.

function typeToCType(type: StaticType):string {
  if (type instanceof ObjectType)
    return 'value_t';
  else
    switch (type) {
    case Integer:
      return 'int32_t'
    case Float:
      return 'float'
    case Boolean:
      return 'int32_t'
    case Void:
      return 'void'
    case String:
    case Null:
    case Any:
      return 'value_t'
    default:
      throw new Error(`${type} has not been supported yet.`)
  }
}

function typeConversion(from: StaticType | undefined, to: StaticType | undefined) {
  let fname
  switch (to) {
    case Integer:
      if (from === Float)
        return '(int32_t)'
      else
        fname = 'value_to_int'
      break
    case Float:
      if (from === Integer)
        return '(float)'
      else
        fname = 'value_to_float'
      break
    case Boolean:
      fname = 'value_to_bool'
      break
    case Void:
      throw new Error('cannot convert void to other types')
    default:
      switch (from) {
        case Integer:
          return 'int_to_value'
        case Float:
          return 'float_to_value'
        case Boolean:
          return 'bool_to_value'
        case Void:
          throw new Error('cannot convert void to other types')
        default:
          return ''
      }
  }

  if (from !== undefined && !isPrimitiveType(from))
    return fname
  else
    return ''
}

// covert any, null, array, function type to a boolean value
const convertToCondition = 'value_to_truefalse'

function arithmeticOpForAny(op: string) {
  switch(op) {
    case '<':
      return 'any_less'     // returns boolean
    case '<=':
      return 'any_less_eq'
    case '>':
      return 'any_greater'
    case '>=':
      return 'any_greater_eq'
    case '+':
      return 'anY_add'      // return any
    case '-':
      return 'any_subtract'
    case '*':
      return 'any_multiply'
    case '/':
      return 'any_divide'
    case '+=':
      return 'any_add_assign'
    case '-=':
      return 'any_subtract_assign'
    case '*=':
      return 'any_multiply_assign'
    case '/-':
      return 'any_divide_assign'
    default:
      throw new Error(`bad operator ${op}`)
  }
}

function makeRootSet(n: number) {
  return `ROOT_SET(_func_rootset, ${n})`
}

const deleteRootSet = 'DELETE_ROOT_SET(_func_rootset)'

// compute a nagative value of an any-type value
const minusAnyValue = '_minus_any_value'

// a getter function for arrays
const arrayElementGetter = 'gc_array_get'    // (value_t, int32_t) => value_t

// makes an array object from elements
const arrayFromElements = 'gc_make_array'         // (value_t, ...) => value_t


export class CodeGenerator extends visitor.NodeVisitor<VariableEnv> {
  result =  new CodeWriter()
  errorLog = new ErrorLog()
  endWithReturn = false

  file(node: AST.File, env: VariableEnv): void {
    visitor.file(node, env, this)
  }

  program(node: AST.Program, env: VariableEnv): void {
    env = new VariableEnv(getVariableTable(node), env)
    for (const child of node.body)
      this.visit(child, env);
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
      if (info.index === undefined)
        this.result.write(node.name)
      else
        this.result.write(info.transpile())
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
      this.result.write(`${convertToCondition}(`)
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
    const env2 = new VariableEnv(getVariableTable(node), env)
    const num = env2.allocateRootSet()
    this.result.nl()
    this.result.write('for (')
    if (node.init)
      this.visit(node.init, env2)

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
    const env2 = new VariableEnv(getVariableTable(node), env)
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
    this.result.write(`{ ${deleteRootSet}; return `)
    if (node.argument) {
      const type = this.needsCoercion(node.argument)
      const retType = env.returnType()
      if (type && retType !== null) {
        this.result.write(`${typeConversion(type, retType)}(`)
        this.visit(node.argument, env)
        this.result.write(')')
      }
      else
        this.visit(node.argument, env)
    }

    this.result.write('; }')
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
    let type = undefined
    for (const decl of node.declarations) {
      const varName = (decl.id as AST.Identifier).name
      const info = env.table.lookup(varName)
      if (info !== undefined) {
        const typeName = typeToCType(info.type)
        if (type === undefined || type === typeName) {
          if (isPrimitiveType(info.type))
            if (type === undefined) {
              type = typeName
              this.result.nl().write(`${typeName} ${varName} `)
            }
            else
              this.result.write(`, ${varName}`)
          else {
            if (type === undefined) {
              this.result.nl()
              type = typeName
            }
            else
              this.result.write(', ')

            this.result.write(info.transpile())
          }

          if (decl.init) {
            const initType = this.needsCoercion(decl.init)
            if (initType) {
              this.result.write(` = ${typeConversion(initType, info.type)}(`)
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
            this.errorLog.push('mixed type declaration is not supported', node)
            break
        }
      }
    }

    this.result.write(';')
    this.endWithReturn = false
  }

  private needsCoercion(node: AST.Node) {
    const coercion = getCoercionFlag(node)
    if (coercion)
      return getStaticType(node)
    else
      return undefined
  }

  variableDeclarator(node: AST.VariableDeclarator, env: VariableEnv): void {
    throw new Error('cannot directly visit AST.VariableDeclarator')
  }

  functionDeclaration(node: AST.FunctionDeclaration, env: VariableEnv): void {
    const fenv = new FunctionEnv(getVariableTable(node), env)
    const funcName = (node.id as AST.Identifier).name
    const funcType = getStaticType(node) as FunctionType;
    const newResult = this.result.copy()
    newResult.right()
    fenv.allocateRootSet()

    this.result.nl().write(`${typeToCType(funcType.returnType)} ${funcName}(`)
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      if (i > 0)
        this.result.write(', ')

      const paramName = (node.params[i] as AST.Identifier).name;
      const paramType = funcType.paramTypes[i];
      this.result.write(`${typeToCType(paramType)} ${paramName}`)

      let info = fenv.table.lookup(paramName)
      if (info?.index !== undefined)
        newResult.nl().write(info.transpile()).write(` = ${paramName};`)
    }

    this.result.write(') {')
    this.result.right()
    const oldResult = this.result
    this.result = newResult
  
    this.result.nl()
    this.visit(node.body, fenv)
  
    oldResult.nl().write(makeRootSet(fenv.getNumOfVars()))
    oldResult.write(this.result.getCode())
    if (funcType.returnType === Void && !this.endWithReturn)
      oldResult.nl().write(deleteRootSet)

    oldResult.left().nl().write('}').nl()
    this.result = oldResult
  }

  unaryExpression(node: AST.UnaryExpression, env: VariableEnv): void {
    this.result.write(node.operator)
    const type = this.needsCoercion(node.argument)
    if (type)
      if (node.operator === '-')
        this.result.write(`${minusAnyValue}(`)
      else if (node.operator === '!') {
        this.result.write('!(')
        this.testExpression(node.argument, env)
        this.result.write(')')
        return
      }
      else if (node.operator === '~')
        this.result.write(`~${typeConversion(type, Integer)}(`)
      else
        this.result.write('(')
    else {
      this.result.write('(')
      this.result.write(node.operator)
    }

    this.visit(node.argument, env)
    this.result.write(')')
  }

  updateExpression(node: AST.UpdateExpression, env: VariableEnv): void {
    // node.argument is not value_t
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
      throw new Error(`bad binary operator ${op}`)
  
    if (node.extra?.parenthesized)
      this.result.write(')')
  }

  equalityExpression(op: string, left: AST.Node, right: AST.Node, env: VariableEnv): void {
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
      this.result.write(`${typeConversion(left_type, Any)}(`)
      this.visit(left, env)
      this.result.write(`) ${op2} ${typeConversion(right_type, Any)}(`)
      this.visit(right, env)
      this.result.write(')')
    }
    else
      this.numericBinaryExprssion(op2, left, right, env)
  }

  // +, -, *, /, <, <=, ... for integer, float, or any-type values
  basicBinaryExpression(op: string, left: AST.Node, right: AST.Node, env: VariableEnv): void {
    const left_type = this.needsCoercion(left)
    const right_type = this.needsCoercion(right)
    if (left_type === Any || right_type === Any) {
      this.result.write(`${arithmeticOpForAny(op)}(${typeConversion(left_type, Any)}(`)
      this.visit(left, env)
      this.result.write(`), ${typeConversion(right_type, Any)}(`)
      this.visit(right, env)
      this.result.write('))')
    }
    else
      this.numericBinaryExprssion(op, left, right, env)
  }

  // binary expression for numeric (integer or float) values
  numericBinaryExprssion(op: string, left: AST.Node, right: AST.Node, env: VariableEnv) {
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
        func = typeConversion(right_type, Any)
      else if (right_type === Any)
        func = typeConversion(Any, left_type)
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
      this.result.write(`${arithmeticOpForAny(op)}(&(`)
      this.visit(left, env)
      this.result.write(`), ${typeConversion(rightType, Any)}(`)
      this.visit(right, env)
      this.result.write('))')
    }
    else if (rightType === Any) {
      this.visit(left, env)
      this.result.write(op)
      this.result.write(` ${typeConversion(Any, leftType)}(`)
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
    this.result.write('(')
    let numOfObjectArgs = 0
    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i]
      if (i > 0)
        this.result.write(', ')

      if (!isPrimitiveType(ftype.paramTypes[i])) {
        ++numOfObjectArgs
        const index = env.allocate()
        this.result.write(rootSetVariable(index)).write('=')
      }

      const arg_type = this.needsCoercion(arg)
      if (arg_type === undefined)
        this.visit(arg, env)
      else {
        this.result.write(`${typeConversion(arg_type, ftype.paramTypes[i])}(`)
        this.visit(arg, env)
        this.result.write(')')
      }
    }

    env.deallocate(numOfObjectArgs)
    this.result.write(')')
  }

  arrayExpression(node: AST.ArrayExpression, env: VariableEnv):void {
    this.result.write(`${arrayFromElements}(`)
    let first = true
    for (const ele of node.elements)
      if (ele !== null) {
        if (first)
          first = false
        else
          this.result.write(', ')

        const type = getStaticType(ele)
        this.result.write(`${typeConversion(type, Any)}(`)
        this.visit(ele, env)
        this.result.write(')')
      }
    this.result.write(')')
  }

  // reader only
  memberExpression(node: AST.MemberExpression, env: VariableEnv): void {
    const elementType = getStaticType(node)
    this.result.write(`${typeConversion(Any, elementType)}(${arrayElementGetter}()`)
    this.visit(node.object, env)
    this.result.write(', ')
    this.visit(node.property, env)
    this.result.write('))')
  }

  tsAsExpression(node: AST.TSAsExpression, env: VariableEnv): void {
    const exprType = getStaticType(node.expression)
    const asType = getStaticType(node)
    this.result.write(`${typeConversion(exprType, asType)}(`)
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

  tsTypeAliasDeclaration(node: AST.TSTypeAliasDeclaration, env: VariableEnv): void {}
}
