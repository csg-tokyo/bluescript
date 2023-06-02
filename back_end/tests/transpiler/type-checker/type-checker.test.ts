import * as AST from "@babel/types"
import * as tested from './test-typechecker'
import * as types from '../../../src/transpiler/types'
import * as names from '../../../src/transpiler/type-checker/names'

test('syntax error', () => {
  const src = `function foo(x: float) : number {
        return x + 1 k
    }`

  let ok = true
  try {
    const ast = tested.transpile(src, 6)
    ok = false
  } catch (e: any) {
    const loc = e.messages[0].location.start
    expect(loc.line).toBe(7)
    expect(loc.column).toBe(20)
  }

  expect(ok).toBeTruthy()
})

test('number literals', () => {
  const src = `const a = 123
  const b = 0x1f
  const c = 0b101
  const d = 1.2
  const e = 3.0
  const f = 1.3e-2`
  const ast = tested.transpile(src)
  const table = names.getNameTable(ast.program)
  expect(table?.lookup('a')?.type).toBe(types.Integer)
  expect(table?.lookup('b')?.type).toBe(types.Integer)
  expect(table?.lookup('c')?.type).toBe(types.Integer)
  expect(table?.lookup('d')?.type).toBe(types.Float)
  expect(table?.lookup('e')?.type).toBe(types.Float)
  expect(table?.lookup('f')?.type).toBe(types.Float)
})

test('other literals', () => {
  const src = `const a = true
  const b = '32'
  const c = null`

  const ast = tested.transpile(src)
  const table = names.getNameTable(ast.program)
  expect(table?.lookup('a')?.type).toBe(types.Boolean)
  expect(table?.lookup('b')?.type).toBe(types.String)
  expect(table?.lookup('c')?.type).toBe(types.Null)
})

test('type declaraton', () => {
  const src = `const k: float = 3
  const i: any = 7
  const j: integer = (k as integer)`
  const ast = tested.transpile(src)
  expect(ast).not.toBeNull()
})

test('bad type declaraton', () => {
  const src = `const k: string = 3
  let j = 7
  j = 'foo'`

  let ok = true
  try {
    tested.transpile(src)
    ok = false
  } catch (e: any) {
    expect(e.messages.length).toBe(2)
  }
  expect(ok).toBeTruthy()
})

test('const declaraton', () => {
  const src = `const k = 3
  k = 1`

  expect(() => tested.transpile(src)).toThrow()
})

test('const declaraton without an initial value', () => {
  const src = 'const k'
  expect(() => tested.transpile(src)).toThrow()
})

test('array variable', () => {
  const src = 'const a = [1, 2, 3]'
  const ast = tested.transpile(src)
  const decl = ast.program.body[0] as AST.VariableDeclaration
  const vardecl = decl.declarations[0]
  const init = vardecl.init
  const type = names.getStaticType(init as AST.Node)
  expect((type as types.ArrayType).elementType).toBe(types.Integer)

  const table = names.getNameTable(ast.program)
  const type2 = table?.lookup('a')?.type
  expect((type2 as types.ArrayType).elementType).toBe(types.Integer)
})

test('array variables', () => {
  const src = `const a = []
  const b = [1, 3.0, 4]
  const c = [1, 2, 'foo']`

  const ast = tested.transpile(src)
  const table = names.getNameTable(ast.program)
  const a = table?.lookup('a')?.type
  expect((a as types.ArrayType).elementType).toBe(types.Any)
  const b = table?.lookup('b')?.type
  expect((b as types.ArrayType).elementType).toBe(types.Float)
  const c = table?.lookup('c')?.type
  expect((c as types.ArrayType).elementType).toBe(types.Any)
})

test('array access', () => {
  const src = `const a = [1, 2, 3]
  const e = a[1+1]`

  const ast = tested.transpile(src)
  const table = names.getNameTable(ast.program)
  const a = table?.lookup('a')?.type
  expect((a as types.ArrayType).elementType).toBe(types.Integer)
  const e = table?.lookup('e')?.type
  expect(e).toBe(types.Integer)
})

test('update an array element', () => {
  const src = `const a = [1, 2, 3]
  const b = a[1+1] = 5`

  const ast = tested.transpile(src)
  const table = names.getNameTable(ast.program)
  const a = table?.lookup('a')?.type
  expect((a as types.ArrayType).elementType).toBe(types.Integer)
  const b = table?.lookup('b')?.type
  expect(b).toBe(types.Any)
})

test('property access', () => {
  const src = `const a = [1, 2, 3]
  const e = a.foo`

  expect(() => tested.transpile(src)).toThrow()
})

test('bad index type', () => {
  const src = `const a = [1, 2, 3]
  const e = a[true]`

  expect(() => tested.transpile(src)).toThrow()
})
