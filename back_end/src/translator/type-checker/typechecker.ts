import { Identifier, Node } from "@babel/types"
import * as AST from '@babel/types';
import { ErrorLog } from "../utils"
import * as visitor from '../visitor'

type Environment = visitor.Environment

export const Integer = 'integer'
export const Float = 'float'
export const Boolean = 'boolean'
export const String = 'string'
export const Void = 'void'
export const Null = 'null'
export const Any = 'any'

export class ObjectType {
    name() { return 'object' }

    isSubtypeOf(t: StaticType): boolean {
        return this === t
    }
}

export const objectType = new ObjectType()

export class FunctionType extends ObjectType {
    returnType: StaticType
    paramTypes: StaticType[]

    constructor(returnType: StaticType, paramTypes: StaticType[]) {
        super()
        this.returnType = returnType
        this.paramTypes = paramTypes
    }

    name() {
        return `${this.paramTypes.map(typeToString)} -> ${typeToString(this.returnType)}`
    }

    isSubtypeOf(t: StaticType): boolean {
        if (t instanceof FunctionType) {
            if (isSubtype(this.returnType, t.returnType)
                && this.paramTypes.length === t.paramTypes.length) {
                for (let i = 0; i < this.paramTypes.length; i++)
                    if (!isSubtype(t.paramTypes[i], this.paramTypes[i]))
                        return false
                return true
            }
        }

        return false
    }
}

export class ArrayType extends ObjectType {
    elementType: StaticType;

    constructor(elementType: StaticType) {
        super();
        this.elementType = elementType;
    }

    name(): string {
        return `${typeToString(this.elementType)}[]`;
    }

    isSubtypeOf(t: StaticType): boolean {
        if (t instanceof ArrayType) {
            return this.elementType === this.elementType;
        }
        return false;
    }
}

export type StaticType = 'integer' | 'float' | 'boolean' | 'string' | 'void' | 'null' | 'any' | ObjectType

export function typeToString(type: StaticType): string {
    if (type instanceof ObjectType)
        return type.name()
    else
        return type
}

// t1 is a subtype of t2 when a t1 value is assignable to a t2 variable without explicit conversion
// with respect to its implementation in the C language.  We here assume that coercion is implicit
// conversion.
export function isSubtype(subtype: StaticType, type: StaticType): boolean {
    if (type === subtype)
        return true     // subclassing has not been implemented yet.
    else if (subtype === Integer && type === Float
             || subtype === String && type === objectType)
        return true
    else if (type === Boolean)
        return subtype !== Void && subtype !== Any
    else if (subtype instanceof ObjectType)
        return subtype.isSubtypeOf(type)
    else
        return false
}

// isConsistent(t1, t2) is true when a t1 value is assignable to a t2 variable
// after explicit conversion.  That conversion may throw a runtime type error.
export function isConsistent(t1: StaticType, t2: StaticType) {
    if (t1 === Any || t2 === Any)
        return t1 !== t2
    else
        return t1 === t2
}

function commonSuperType(t1: StaticType, t2: StaticType): StaticType | null {
    if (isSubtype(t1, t2))
        return t2
    else if (isSubtype(t2, t1))
        return t1
    else
        return null
}

export class NameInfo {
    type: StaticType
    is_type_name: boolean

    constructor(t: StaticType) {
        this.type = t
        this.is_type_name = false
    }

    isTypeName(): boolean {
        return this.is_type_name
    }
}

// Name table

export interface NameTable extends Environment {
    record(key: string, t: StaticType): boolean
    lookup(key: string): NameInfo | undefined
}

export class GlobalNameTable implements NameTable {
    names: Map<string,NameInfo>

    constructor() {
        this.names = new Map()
    }

    record(key: string, type: StaticType): boolean {
        const old = this.names.get(key)
        this.names.set(key, new NameInfo(type));
        return old === undefined
    }

    lookup(key: string): NameInfo | undefined {
        return this.names.get(key)
    }
}

export class FunctionNameTable implements NameTable {
    names: {[key: string]: NameInfo }
    parent: NameTable

    constructor(parent: NameTable) {
        this.names = {}
        this.parent = parent
    }

    record(key: string, type: StaticType): boolean {
        const old = this.names[key]
        this.names[key] = new NameInfo(type)
        return old !== undefined
    }

    lookup(key: string): NameInfo | undefined {
        const found = this.names[key]
        if (found === undefined)
            return this.parent.lookup(key)
        else
            return found
    }
}

export class BlockNameTable extends FunctionNameTable {
    constructor(parent: NameTable) {
        super(parent)
    }
}

function addNameTable(node: Node, nt: NameTable) {
    ((node as unknown) as { nameTable: NameTable }).nameTable = nt
}

export function getNameTable(node: Node) {
    return ((node as unknown) as { nameTable?: NameTable }).nameTable
}

function addStaticType(node: Node, type: StaticType) {
    ((node as unknown) as { staticType: StaticType }).staticType = type
}

export function getStaticType(node: Node, type: StaticType) {
    return ((node as unknown) as { staticType?: StaticType }).staticType
}

export class Typechecker extends visitor.NodeVisitor {
    errorLog = new ErrorLog()
    result: StaticType = Any

    file(node: AST.File, env: Environment): void {
        visitor.file(node, env, this)
    }

    program(node: AST.Program, env: Environment): void {
        addNameTable(node, env as NameTable)
        for (const child of node.body)
            this.visit(child, env)
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
        if (this.assert(name_info !== undefined, `unknown name: ${node.name}`, node)) {
            const info = name_info as NameInfo
            if (this.assert(!info.isTypeName(), `bad use of type name: ${node.name}`, node)) {
                this.result = info.type
                return
            }
        }

        this.result = Any
    }

    whileStatement(node: AST.WhileStatement, env: Environment): void {
        this.visit(node.test, env)
        this.addCoercionForBoolean(node.test, this.result)
        this.visit(node.body, env)
    }

    ifStatement(node: AST.IfStatement, env: Environment): void {
        this.visit(node.test, env)
        this.addCoercionForBoolean(node.test, this.result) // TODO: これはどういうこと？
        this.visit(node.consequent, env)
        if (node.alternate)
            this.visit(node.alternate, env)
    }

    forStatement(node: AST.ForStatement, env: Environment): void {
        if (node.init)
            this.visit(node.init, env)

        if (node.test) {
            this.visit(node.test, env)
            this.addCoercionForBoolean(node.test, this.result)
        }
    
        if (node.update)
            this.visit(node.update, env)

        this.visit(node.body, env)
    }

    expressionStatement(node: AST.ExpressionStatement, env: Environment): void {
        this.visit(node.expression, env)
    }

    blockStatement(node: AST.BlockStatement, env: Environment): void {
        this.assertSyntax(node.directives.length === 0, node)
        const block_env = new BlockNameTable(env as NameTable)
        addNameTable(node, block_env)
        for (const child of node.body)
            this.visit(child, block_env)
    }

    returnStatement(node: AST.ReturnStatement, env: Environment): void {
        if (node.argument)
            this.visit(node.argument, env)
    }

    emptyStatement(node: AST.EmptyStatement, env: Environment): void {
        return
    }

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
        let varType: StaticType = Any
        const typeAnno = id.typeAnnotation
        if (typeAnno != null) {
            this.assertSyntax(AST.isTSTypeAnnotation(typeAnno), typeAnno)
            this.visit(typeAnno, env)
            varType = this.result
        }

        if (node.init) {
            this.visit(node.init, env)
            this.assert(this.result !== Void, 'void may not be an initial value.', node.init)
            if (varType === null)
                varType = this.result
            else if (isConsistent(varType, this.result))
                addStaticType(node.init, this.result)
            else
                this.assert(isSubtype(this.result, varType),
                            `Type '${typeToString(this.result)}' is not assignable to type '${typeToString(varType)}'.`, node)
        }

        const success = (env as NameTable).record(varName,varType)
        this.assert(success, `Identifier '${varName}' has already been declared.`, node)
    }

    functionDeclaration(node: AST.FunctionDeclaration, env: Environment): void {
        this.assert(!node.generator, 'generator functions are not supported.', node)
        this.assert(!node.async, 'async functions are not supported.', node)
        const names = env as NameTable
        if (node.id != null) {
            const name_info = names.lookup(node.id.name)
            // TODO: このif文はどういうこと？ 新しく定義する関数だからunknownで良いのでは？
            if (this.assert(name_info !== undefined, `unknown name: ${node.id.name}`, node)) {
                const info = name_info as NameInfo
                if (this.assert(!info.isTypeName(), `bad use of type name: ${node.id.name}`, node)) {
                    const func_type = info.type
                    const local_env = getNameTable(node)
                    if (local_env != null)
                        this.visit(node.body, local_env)
                    else
                        throw new ErrorLog().push(`no local environment found`, node)
                }
            }
        }
    }

    unaryExpression(node: AST.UnaryExpression, env: Environment): void {
        this.assert(node.prefix, 'prefixed unary operator is not supported', node)
        this.visit(node.argument, env)
        const op = node.operator
        if (op === '-' || op === '+')
            this.assert(this.result === Integer || this.result === Float,
                        this.invalidOperandMessage(op, this.result), node);
        else if (op === '!') {
            addStaticType(node.argument, this.result)
            this.result = Boolean
        }
        else if (op === '~') {
            this.assert(this.result === Integer,
                        this.invalidOperandMessage(op, this.result), node);
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
        this.assert(this.result === Integer || this.result === Float,
                    this.invalidOperandMessage(op, this.result), node);
    }

    binaryExpression(node: AST.BinaryExpression, env: Environment): void {
        this.visit(node.left, env)
        const left_type = this.result
        this.visit(node.right, env)
        const right_type = this.result
        const op = node.operator
        if (op === '==' || op === '!=' || op === '===' || op ==='!==') {
            addStaticType(node.left, left_type)
            addStaticType(node.right, right_type)
            this.result = Boolean
        }
        else if  (op === '<' || op === '<=' || op === '>' || op === '>=') {
            this.assert((left_type === Integer || left_type === Float)
                         && (right_type === Integer || right_type === Float),
                        this.invalidOperandsMessage(op, left_type, right_type), node)
            this.result = Boolean
        }
        else if (op === '+' || op === '-' || op === '*' || op === '/') {
            this.assert((left_type === Integer || left_type === Float)
                         && (right_type === Integer || right_type === Float),
                         this.invalidOperandsMessage(op, left_type, right_type), node)
            if (left_type === Float || right_type === Float) {
                addStaticType(node.left, Float);
                addStaticType(node.right, Float);
                this.result = Float
            }else {
                addStaticType(node.left, Integer);
                addStaticType(node.right, Integer);
                this.result = Integer
            }
        }
        else if (op === '|' || op === '^' || op === '&' || op === '%' || op === '<<' || op === '>>') {
            this.assert(left_type === Integer && right_type === Integer,
                        this.invalidOperandsMessage(op, left_type, right_type), node)
            addStaticType(node.left, Integer);
            addStaticType(node.right, Integer);
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
        if (op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=' || op === '%=')
            // Question: integer, float以外の変数の代入はできないのか？
            this.assert((left_type === Integer || left_type === Float)
                         && (right_type === Integer || right_type === Float),
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
        if (result_type === null) {
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
                    addStaticType(arg, this.result)
                else
                    this.assert(isSubtype(this.result, func_type.paramTypes[i]),
                                `passing an incompatible argument (${this.result} to ${func_type.paramTypes[i]})`,
                                node)
            }
            this.result = func_type.returnType
        }
        else {
            this.assert(false, 'the callee is not a function', node.callee)
            this.result = Any
        }
    }

    arrayExpression(node: AST.ArrayExpression, env: Environment): void {
        return
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

    tsArrayType(node: AST.TSArrayType, env: Environment): void {
        this.visit(node.elementType, env);
        const elementType = this.result;
        this.result = new ArrayType(elementType);
    }

    addCoercionForBoolean(expr: Node, type: StaticType): void {
        // if the expression needs coercion to be tested as a boolean value.
        // In C, 0, 0.0, and NULL are false.
        if (type === Any)
            addStaticType(expr, type)
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
