import * as AST from "@babel/types"
import { expect, test } from '@jest/globals'
import * as tested from './test-typechecker'
import * as types from '../../src/transpiler/types'
import * as names from '../../src/transpiler/names'
import * as clazz from '../../src/transpiler/classes'

test('syntax error', () => {
  const src = `function foo(x: float) : number {
        return x + 1 k
    }`

  expect(() => tested.transpile(src, 6)).toThrow(/7:20/)
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
  expect(table?.lookup('a')?.type).toBe(types.BooleanT)
  expect(table?.lookup('b')?.type).toBe(types.StringT)
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

  expect(() => tested.transpile(src)).toThrow(/line 1.*\n.*line 3/)
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
  expect(b).toBe(types.Integer)
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

test('duplicated parameter names', () => {
  const src = `function foo(a: number, b, a) { return a }`
  expect(() => tested.transpile(src)).toThrow()
})

test('duplicated function declarations', () => {
  const src = `function foo(a: number) { return a }
function foo(a: number) { return a + 1}`
  expect(() => tested.transpile(src)).toThrow()
})

test('type conversion from a function to any', () => {
  const src = `function foo(a: number) { return a }
  const f:any = foo    // runtime error
`
  expect(() => tested.transpile(src)).not.toThrow()
})

test('type conversion to a function from any', () => {
  const src = `function foo(a: number) { return a }
let f = foo
const g: any = null
f = g    // runtime error
`
  expect(() => tested.transpile(src)).not.toThrow()
})

test('top-level return', () => {
  const src = 'return 3'
  expect(() => tested.transpile(src)).toThrow(/return.*outside/)
})

test('assign to a function name', () => {
  const src = `function foo(x: integer) { return x }
  function bar(x: integer) { return x + 1 }
  function baz() { foo = bar }
  `
  expect(() => tested.transpile(src)).toThrow(/assignment to top-level.*line 3/)
})

test('function type', () => {
  const src = `let foo: (a: float, b: string)=>integer
`
  const ast = tested.transpile(src)
  const table = names.getNameTable(ast.program)
  const a = table?.lookup('foo')?.type
  expect((a as types.FunctionType).paramTypes[0]).toBe(types.Float)
  expect((a as types.FunctionType).paramTypes[1]).toBe(types.StringT)
  expect((a as types.FunctionType).returnType).toBe(types.Integer)
})

test('import', () => {
  const src = `
  export function foo(): integer { return 1 }
  export function bar(): integer { return 2 }
  `
  const src2 = `
  import type { integer, float } from 'bluescript.ts'
  import { foo } from 'foo.ts'
  function bar(): string { return 'bar' }
  const a = foo()
  const b = bar()
  `

  const src3 = `
  import { foo } from 'bar.ts'
  function bar(): string { return 'bar' }
  const a = foo()
  `

  const src4 = `
  function foo(): integer[] { return 1 }
  function bar(): string { return 2 }
  `

  const src5 = `
  import { foo } from 'foo.ts'
  function bar(): string { return 'bar' }
  const a = foo()
  const b: integer = bar()
  `

  const ast = tested.transpile(src2, 1, 'foo.ts', src)
  const table = names.getNameTable(ast.program)
  const a = table?.lookup('a')?.type
  const b = table?.lookup('b')?.type
  expect(a).toBe(types.Integer)
  expect(b).toBe(types.StringT)

  expect(() => tested.transpile(src3, 1, 'foo.ts', src)).toThrow(/cannot find/)
  expect(() => tested.transpile(src5, 1, 'foo.ts', src4)).toThrow(/line 2.*foo\.ts\n.*line 3.*foo\.ts\n.*line 5/)
})

test('InstanceType.subclasses() and ClassTable.roots()', () => {
  const src = `
  class Foo {}
  class Bar extends Foo {}
  class Baz extends Foo {}
  class Foo2 {}
`
  const ast = tested.transpile(src)
  const table = names.getNameTable(ast.program)
  const t = table?.lookup('Foo')?.type

  const subs = (t as clazz.InstanceType).subclasses()
  expect(subs.length).toBe(2)
  expect(subs[0].name()).toBe('Bar')
  expect(subs[1].name()).toBe('Baz')

  const roots = table?.classTable()?.roots()
  expect(roots !== undefined && roots.length).toBe(3)
  expect(roots !== undefined && roots[0].name()).toBe('Uint8Array')
  expect(roots !== undefined && roots[1].name()).toBe('Foo')
  expect(roots !== undefined && roots[2].name()).toBe('Foo2')
})
