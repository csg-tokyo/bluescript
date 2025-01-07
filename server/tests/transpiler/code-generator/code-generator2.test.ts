import { execSync } from 'child_process'
import { compileAndRun, multiCompileAndRun, importAndCompileAndRun, transpileAndWrite, toBoolean } from './test-code-generator'
import { expect, test, beforeAll } from '@jest/globals'
import { GlobalVariableNameTable } from '../../../src/transpiler/code-generator/variables'
import { booleanLiteral } from '@babel/types'

beforeAll(() => {
  execSync('mkdir -p ./temp-files')
})

const destFile = './temp-files/bscript2_'

class Importer {
  moduleId: number
  modules: { name: string, source: string }[]
  nameTable?: GlobalVariableNameTable
  fileNames: { file: string, main: string }[]
  path: string

  constructor(mods: { name: string, source: string }[]) {
    this.modules = mods
    this.moduleId = 0
    this.fileNames = []
    this.path =  destFile
  }

  init() {
    return (n: GlobalVariableNameTable) => this.nameTable = n
  }

  reset() {
    this.moduleId = 0
    this.fileNames = []
  }

  importer() {
    const importerFunction = (f: string) => {
      const mod = this.modules.find((v, i, obj) => v.name === f)
      if (mod === undefined)
          throw `cannot find a module ${f}`

      this.moduleId += 1
      const fname =  `./temp-files/m${this.moduleId}_bscript.c`
      const result = transpileAndWrite(1, mod.source, fname,
                                       this.nameTable, this.moduleId, importerFunction)
      this.fileNames.push({ file: fname, main: result.main })
      return result.names
    }
    return importerFunction
  }

  files() { return () => this.fileNames }
}

test('import declaration', () => {
  const modules = [
    { name: 'foo', source: `
  export const foobaz = 3
  export const foobaz2 = 'foo'
` },
    { name: 'bar', source: `
  const g = 'bar'
  export function barf(x: integer) { return x }
  export function getg() { return g }
` }]

  const src = `
import { foobaz } from 'foo'
print(foobaz)
`
  const imp = new Importer(modules)
  expect(importAndCompileAndRun(src, imp.importer(), imp.init(), imp.files(), imp.path)).toBe('3\n')

  const src2 = `
import { barf } from 'bar'
print(barf(5))
`
  imp.reset()
  expect(importAndCompileAndRun(src2, imp.importer(), imp.init(), imp.files(), imp.path)).toBe('5\n')

  const src3 = `
import { foobaz2 } from 'foo'
import { getg } from 'bar'

const g = 'src3'
function barf() {
  print(g)
  print(getg())
  print(foobaz2)
}

barf()
`
  imp.reset()
  expect(importAndCompileAndRun(src3, imp.importer(), imp.init(), imp.files(), imp.path)).toBe('src3\nbar\nfoo\n')

  const src4 = `
  import { foobaz3 } from 'foo'
  print(foobaz3)
  `
    imp.reset()
    expect(() => importAndCompileAndRun(src4, imp.importer(), imp.init(), imp.files(), imp.path)).toThrow(/'foobaz3' is not found in foo/)
})

test('import an arrow function', () => {
  const modules = [
    { name: 'foo', source: `
  export let foo = (a: integer) => a + 1
  export function foofoo() {
    foo = (a: integer) => a * 10
  }
` },
    { name: 'bar', source: `
  export let bar = (a: integer) => a + 2
  export function barbar() {
    bar = (a: integer) => a * 20
  }
` }]

  const src = `
import { foo, foofoo } from 'foo'
import { bar, barbar } from 'bar'
print(foo(3))
foofoo()
print(foo(3))
print(bar(5))
barbar()
print(bar(5))
`
  const imp = new Importer(modules)
  expect(importAndCompileAndRun(src, imp.importer(), imp.init(), imp.files(), imp.path)).toBe([4, 30, 7, 100].join('\n') + '\n')
})

test('import a class', () => {
  const modules = [
    { name: 'foo', source: `
  export class Foo {
    value: string
    constructor(s: string) { this.value = s }
    get() { return this.value }
  }

  export function foo(s: string) { return new Foo(s) }
` },
    { name: 'bar', source: `
  export class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
    get() { return this.value }
  }

  export class Bar {
    value: float
    constructor(f: float) { this.value = f }
    get() { return this.value }
  }

  export function bar(i: integer) { return new Foo(i) }
` }]

  const src = `
import { Foo } from 'foo'
import { bar } from 'bar'
print(new Foo('ff').get())
print(bar(7).get())
`
  const imp = new Importer(modules)
  expect(importAndCompileAndRun(src, imp.importer(), imp.init(), imp.files(), imp.path)).toBe('ff\n7\n')

  const src2 = `
  import { Foo, foo } from 'foo'
  import { bar } from 'bar'
  print(foo('ff').get())
  print(bar(7).get())
  `
  imp.reset()
  expect(importAndCompileAndRun(src2, imp.importer(), imp.init(), imp.files(), imp.path)).toBe('ff\n7\n')

  const src3 = `
  import { Foo, foo } from 'foo'
  import { Foo, bar } from 'bar'   // Foo has been already imported.
  print(foo('ff').get())
  print(bar(7).get())
  `
  imp.reset()
  expect(() => importAndCompileAndRun(src3, imp.importer(), imp.init(), imp.files(), imp.path)).toThrow(/Foo.*line 3/)
})

test('import an unexported function', () => {
  const modules = [
    { name: 'foo', source: `
  let foo = (a: integer) => a + 1
  export function foofoo() {
    foo = (a: integer) => a * 10
  }
` },
    { name: 'bar', source: `
  let bar = (a: integer) => a + 2
  export function getbar() { return bar }
  function barbar() {
    bar = (a: integer) => a * 20
  }
` }]

  const src = `
import { foo } from 'foo'
print(foo(3))
`
  const imp = new Importer(modules)
  expect(() => importAndCompileAndRun(src, imp.importer(), imp.init(), imp.files(), imp.path)).toThrow(/'foo' is.*not exported/)

  const src2 = `
import { barbar, getbar } from 'bar'
import { foo } from 'foo'
print(getbar()(3))
`
  imp.reset()
  expect(() => importAndCompileAndRun(src2, imp.importer(), imp.init(), imp.files(), imp.path)).toThrow(/'barbar' is.*not exported.*\n.*'foo' is.*not exported/)
})

test('nested import declarations', () => {
  const modules = [
    { name: 'foo', source: `
  let foo = (a: integer) => a + 1
  export function foofoo() {
    return foo
  }
` },
    { name: 'bar', source: `
  import { foofoo } from 'foo'

  export const barbar = (a) => foofoo()(a)
` }]

  const src = `
import { barbar } from 'bar'
print(barbar(7))
`
  const imp = new Importer(modules)
  expect(importAndCompileAndRun(src, imp.importer(), imp.init(), imp.files(), imp.path)).toBe('8\n')
})

test('/ and /= operators', () => {
  const src = `
  let a = 239
  let b = a / 13
  print(b)
  a /= 4
  print(a)
`

  expect(compileAndRun(src, destFile)).toBe('18\n59\n')

  const src1 = `
  let a = 239.3
  let b = a / 13.2
  print(b)
  a /= 4.3
  print(a)
`

  expect(compileAndRun(src1, destFile)).toBe('18.128788\n55.651165\n')

  const src2 = `
  let a: any = 239
  let b = a / 13
  print(b)
  let c: any = 13
  let d = a / c
  print(d)
  let e = 239 / c
  print(e)
  let f = a /= 4
  print(a)
  print(f)
  print(typeof f)
  let i: integer = 239
  let j = i /= c
  print(i)
  print(j)
  print(typeof j)
  `

  expect(compileAndRun(src2, destFile)).toBe('18\n18\n18\n59\n59\nany\n18\n18\ninteger\n')

  const src3 = `
  let a: any = 239.3
  let b = a / 13.2
  print(b)
  let c: any = 13.2
  let d = a / c
  print(d)
  let e = 239.3 / c
  print(e)
  let f = a /= 4.7
  print(a)
  print(f)
  print(typeof f)
  let i: float = 239.3
  let j = i /= c
  print(i)
  print(j)
  print(typeof j)
  `

  expect(compileAndRun(src3, destFile)).toBe('18.128788\n18.128788\n18.128788\n50.914898\n50.914898\nany\n18.128788\n18.128788\nfloat\n')
})

test('% and %= operators', () => {
  const src = `
  let a = 239
  let b = a % 13
  print(b)
  a %= 4
  print(a)
`

  expect(compileAndRun(src, destFile)).toBe('5\n3\n')

  const src2 = `
  let a: any = 239
  let b = a % 13
  print(b)
  let c: any = 13
  let d = a % c
  print(d)
  let e = 239 % c
  print(e)
  let f = a %= 4
  print(a)
  print(f)
  print(typeof f)
  let i: integer = 239
  let j = i %= c
  print(i)
  print(j)
  print(typeof j)
  `

  expect(compileAndRun(src2, destFile)).toBe('5\n5\n5\n3\n3\nany\n5\n5\ninteger\n')
})

test('** operator', () => {
  const src = `
  let a = 3
  let b = 2
  let c = 3.0
  let d = 2.0
  print(a ** b)
  print(c ** d)
  print(a ** d)
  print(c ** b)
`

  expect(compileAndRun(src, destFile)).toBe('9\n9.000000\n9.000000\n9.000000\n')

  const src2 = `
  let a: any = 3
  let b: any = 2
  print(a ** b)
  a = 3.0
  print(a ** b)
  print(b ** a)
  b = 2.0
  print(a ** b)
`

  expect(compileAndRun(src2, destFile)).toBe('9\n9.000000\n8.000000\n9.000000\n')
})

test('instanceof', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  class Bar extends Foo{
    value: string
    constructor(s: string) { super(3); this.value = s }
  }

  class Baz extends Bar {
    fvalue: float
    constructor() { super('baz'); this.fvalue = 0.3 }
  }

  let obj = new Foo(17)
  print(obj instanceof Foo)
  print(!(obj instanceof Foo))

  print('foo' instanceof string)
  print(!('foo' instanceof string))

  let obj2 = new Bar('foo')
  print(obj2 instanceof Bar)
  print(obj2 instanceof Foo)
  print(null instanceof Foo)
  print(undefined instanceof Foo)

  let obj3 = new Baz()
  print(obj3 instanceof Foo)
  print(obj3 instanceof Bar)
  print(obj3 instanceof Baz)
  print(obj2 instanceof Baz)
  `

  expect(compileAndRun(src, destFile)).toBe(toBoolean([1, 0, 1, 0, 1, 1, 0, 0,  1, 1, 1, 0]).join('\n') + '\n')

  const src2 = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }

  let obj3: any = 3
  print(obj3 instanceof Foo)
  print(obj3 instanceof string)
  obj3 = 'foo'
  print(obj3 instanceof Foo)
  print(obj3 instanceof string)
  obj3 = null
  print(obj3 instanceof Foo)
  print(obj3 instanceof string)
  obj3 = [1, 2, 3]
  print(obj3 instanceof Foo)
  print(obj3 instanceof string)
  `

  expect(compileAndRun(src2, destFile)).toBe(toBoolean([0, 0, 0, 1, 0, 0, 0, 0]).join('\n') + '\n')

  const src3 = `
  print((1 + 2) instanceof string)
  `

  expect(() => compileAndRun(src3, destFile)).toThrow(/instanceof/)
})

test('issue #15.  Cannot access a property of class type when a class declaration or an object creation is not in the same file.', () => {
  const src = `
  class Foo {
    value: Foo
    constructor(i: integer) { this.value = this }
  }
  let obj = new Foo(17)
  `

  const src2 = `
  print(obj.value)
  `

  const src3 = `
  print(obj.value instanceof Foo)
  `

  expect(multiCompileAndRun(src, src2, destFile)).toBe('<class Foo>\n')
  expect(multiCompileAndRun(src, src3, destFile)).toBe('true\n')
})

test('Uint8Array', () => {
  const src = `
  function foo() {
    const a = new Uint8Array(3, 7)
    print(a.length)
    a[0] = 13
    a[1] = 9
    print(a[0])
    const b: any = a
    print(b.length)
    b[1] = 73
    print(b[1])
    print((b as Uint8Array)[2])
    const c: Uint8Array = b
    print(c[0])
  }
  foo()
  `

  expect(compileAndRun(src, destFile)).toBe([3, 13, 3, 73, 7, 13].join('\n') + '\n')
})

test('Uint8Array is a leaf class', () => {
  const src = `
  class Foo extends Uint8Array {}
  `

  expect(() => compileAndRun(src, destFile)).toThrow(/invalid super class/)
})

test('instanceof array', () => {
  const src = `
  class Foo {}
  const a1 = [1, 2, 3]
  const a2 = [0.1, 0.2]
  const a3 = ['foo', 'bar']
  const a4 = [new Foo()]
  print(a1 instanceof Array)
  print(a2 instanceof Array)
  print(a3 instanceof Array)
  print(a4 instanceof Array)
  `

  expect(compileAndRun(src, destFile)).toBe('true\ntrue\ntrue\ntrue\n')
})

test('object array', () => {
  const src = `
  class Foo {
    value: integer
    constructor(n) { this.value = n }
  }
  `
  const src2 = `
  const a = new Array<Foo>(n)
  `
  expect(() => compileAndRun(src + src2, destFile)).toThrow(/wrong number of arguments/)

  const src3 = `
  const a = new Array<Foo>(n, null)
  `
  expect(() => compileAndRun(src + src3, destFile)).toThrow(/incompatible argument/)

  const src5 = `
  function foo(n: integer) {
    const obj = new Foo(7)
    const a = new Array<Foo>(n, obj)
    return a
  }

  const arr = foo(3)
  print(arr[0].value)

  const v: any = arr
  print(v[0].value)

  const arr2 = v
  print(arr2[0].value)

  v[0].value = 13
  const arr2d = [ arr ]
  print(arr2d[0])
  print(arr2d[0][0].value)
  `
  expect(compileAndRun(src + src5, destFile)).toBe('7\n7\n7\n<class Foo[]>\n13\n')
})

test('array access in multiple source files', () => {
  const src1 = `
  class Foo {
    value: integer
    constructor(x: integer) { this.value = x }
    make(n) { return new Array<Foo>(n, this) }
  }

  function foo(a) {
    return a[0]
  }
  `
  const src2 = `
  function bar() {
    const a = new Foo(7).make(3)
    print(typeof a)
    const b: any = a
    const aa: Foo[] = b
    print(foo(aa))
  }

  bar()
  `

  expect(multiCompileAndRun(src1, src2, destFile)).toBe('Foo[]\n<class Foo>\n')
})

test('void may not be a condition or an operand', () => {
  const src = `
  function foo(v: integer) {
    if (v > 0 && print(v))  // error
      return v
    else if (print(v))      // error
      return -v
    else
      return 0
  }
  foo(3)
  `
  expect(() => compileAndRun(src, destFile)).toThrow(/void may not be.*line 3.*\n.*void may not be.*line 5/)
})

test('do-while statement', () => {
  const src = `
  function foo(n: integer) {
    let i = 0
    do
      i += 1
    while (i < n)
    return i
  }

  function bar(n: integer) {
    let i = 0, j = 0
    do {
      i += 1
      j += 10
    } while (i < n)
    return i + j
  }

  print(foo(3))
  print(bar(7))
  `

  expect(compileAndRun(src, destFile)).toBe('3\n77\n')
})

test('no initailizer for a variable', () => {
  const src = `
  let a: integer
  let b: float
  let c: boolean
  let d: any
  let e: string | undefined
  `

  const src2 = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  let e: Foo
  `
  expect(compileAndRun(src, destFile)).toBe('')
  expect(() => compileAndRun('let a: string', destFile)).toThrow(/must have an initial value/)
  expect(() => compileAndRun('let a: integer[]', destFile)).toThrow(/must have an initial value/)
  expect(() => compileAndRun('let a: ()=>boolean', destFile)).toThrow(/must have an initial value/)
  expect(() => compileAndRun(src2, destFile)).toThrow(/must have an initial value.*line 6/)
})

test('nullable object types', () => {
  const tester = (type: string, init: string, value: string, getter: string = '') => {
    const src = `
  class Foo {
    value() { return 'foo' }
  }

  let obj: ${type} | undefined = ${init}
  print(typeof obj)
  print(obj instanceof ${type})
  print(obj)
  let v: any = obj
  obj = v
  const foo = obj as ${type}
  print(foo${getter})
  obj = undefined
  print(obj instanceof ${type})
  print(obj)
  `
    expect(compileAndRun(src, destFile)).toBe(`${type}|undefined\ntrue\n<class ${type}>\n${value}\nfalse\nundefined\n`)
  }

  tester('Foo', 'new Foo()', 'foo', '.value()')
  tester('Uint8Array', 'new Uint8Array(3, 7)', '7', '[0]')
})

test('nullable arrays', () => {
  const tester = (type: string, init: string, value: string, getter: string = '') => {
    const src = `
  class Foo {
    value() { return 'foo' }
  }
  let ar1: ${type}[] | undefined = ${init}     // array | undefined = array
  let tar1: ${type}[] = ar1 as ${type}[]       // array = (array | undefined) as array
  print(tar1[0]${getter})
  let a1: any = ar1                            // any = array | undefined
  let ar1b: ${type}[] | null = a1              // array | undefined = any
  let tar1b: ${type}[] = ar1b as ${type}[]
  print(tar1b[0]${getter})
  ar1 = null
  print(ar1)
  `
    expect(compileAndRun(src, destFile)).toBe(`${value}\n${value}\nundefined\n`)
  }

  tester('integer', '[7, 8, 9]', '7')
  tester('float', '[7.1, 8.1, 9.1]', '7.100000')
  tester('boolean', '[true, false, true]', 'true')
  tester('string', '["one", "two", "three"]', 'one')
  tester('any', '[true, "apple", 9]', 'true')
  tester('Foo', 'new Array<Foo>(3, new Foo())', 'foo', '.value()')
})

test('subtypes of union types', () => {
  const src = `
  class Foo {}
  class Bar extends Foo {}
  let v: Bar | undefined = new Bar()
  let w: Foo | undefined = v
  w = new Bar()
  print(w)
  `

  expect(compileAndRun(src, destFile)).toBe('<class Bar>\n')
})

test('equality for nullable types', () => {
  const tester = (type: string, init: string, value: string) => {
    const src = `
  class Foo {}
  let obj: ${type} | undefined = ${init}
  let obj2 = obj
  print(obj === ${value})
  print(obj !== ${value})
  `
    expect(compileAndRun(src, destFile)).toBe(`true\nfalse\n`)
  }

  tester('string', '"foo"', '"foo"')
  tester('string', '"foo"', 'obj2')
  tester('Foo', 'new Foo()', 'obj2')
  tester('integer[]', '[1, 2, 3]', 'obj2')
})

test('(any | undefined) is any', () => {
  const src = `
  let v: any | undefined = 'foo'
  print(typeof v)
  `

  expect(compileAndRun(src, destFile)).toBe('any\n')
})

test('unsupported union type', () => {
  const src = `
  let i: any = 7
  let v: integer | undefined = i
  print(v)
  `

  expect(() => compileAndRun(src, destFile)).toThrow(/not supported union type/)
})

test('type guard', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined) {
    if (v !== undefined) {
      print(typeof(v))
      print(v.value)
    }
    else {
      print(typeof(v))
      print('undefined')
    }
  }
  foo(new Foo(7))
  foo(undefined)
  `

  expect(compileAndRun(src, destFile)).toBe('Foo\n7\nFoo|undefined\nundefined\n')
})

test('type guard with assignment of null', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined) {
    if (v !== undefined) {
      print(typeof(v))
      print(v.value)
      v = undefined
      print(v.value)
    }
    else {
      v = new Foo(3)
      print(typeof(v))
    }
  }
  foo(new Foo(7))
  `

  expect(() => compileAndRun(src, destFile)).toThrow(/unknown property name.*line 11/)
})

test('type guard with assignment of null 2', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined) {
    if (v !== undefined) {
      print(typeof(v))
      print(v.value)
      v = undefined
      print(typeof(v))
    }
    else {
      print(typeof(v))
      v = new Foo(3)
      print(typeof(v))
    }
  }
  foo(new Foo(7))
  foo(undefined)
  `

  expect(compileAndRun(src, destFile)).toBe('Foo\n7\nFoo|undefined\nFoo|undefined\nFoo|undefined\n')
})

test('nested type guard', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined, w: Foo | undefined) {
    if (v !== undefined) {
      if (w !== undefined) {
        print(w.value)
      }
      print(v.value)
      print(typeof(w))    // Foo|undefined
    }
    w = new Foo(9)
    if (v != undefined) {
      if (w !== undefined)
        print(w.value)
      print(typeof(w))
      print(v.value)
    }
    print(typeof(v))
  }
  foo(new Foo(7), new Foo(3))
  `

  expect(compileAndRun(src, destFile)).toBe('3\n7\nFoo|undefined\n9\nFoo|undefined\n7\nFoo|undefined\n')
})

test('wrong nested type guard', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined) {
    if (v !== undefined) {
      print(typeof(v))
      if (v !== undefined)    // error.  v is not null.
        print(typeof(v))
    }
  }
  foo(new Foo(7))
  `

  expect(() => compileAndRun(src, destFile)).toThrow(/invalid operands.*line 9/)
})

test('type guard and loop', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined) {
    let i = 1
    if (v !== undefined) {
      print(typeof(v))
      while (i > 0) {
        print(typeof(v))    // Foo|undefined
        v = undefined
        i -= 1
      }
    }
  }
  function bar(v: Foo | undefined) {
    if (v === undefined)
      return
    else
      print2(v = undefined, typeof(v))    // typeof(v) is Foo|undefined
  }
  function baz(v: Foo | undefined) {
    let w: Foo | undefined = undefined
    if (v !== undefined)
      print2(w = undefined, typeof(v))    // typeof(v) is Foo
  }
  function print2(v: Foo | undefined, s: string) {
    print(s)
  }
  foo(new Foo(7))
  bar(new Foo(7))
  baz(new Foo(7))
  `

  expect(compileAndRun(src, destFile)).toBe('Foo\nFoo|undefined\nFoo|undefined\nFoo\n')
})

test('type guard and assignment in condition', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined) {
    let i = 1
    if (v !== undefined) {
      if ((v = undefined) || display(typeof(v)) || i > 0)    // typeof(v) is Foo|undefined
        print(typeof(v))                                     // typeof(v) is Foo|undefined
    }
  }
  function display(s: string) {
    print(s)
    return false
  }
  foo(new Foo(7))
  `

  expect(compileAndRun(src, destFile)).toBe('Foo|undefined\nFoo|undefined\n')
})

test('type guards are not effective in the body of a lambda function', () => {
  const src = `
  class Foo {
    value: integer
    constructor(i: integer) { this.value = i }
  }
  function foo(v: Foo | undefined) {
    let func = (v: Foo | undefined) => { print('default'); print(typeof(v)) }
    if (v !== undefined) {
      func = (w: Foo | undefined) => {
        print('lambda'); print(typeof(v))   // lambda, Foo | undefined
        if (w !== undefined)
          print(typeof(w))        // Foo
      }
      print(typeof(v))            // Foo
    }
    func(new Foo(3))
  }

  foo(new Foo(7))
  `

  expect(compileAndRun(src, destFile)).toBe('Foo\nlambda\nFoo|undefined\nFoo\n')
})
