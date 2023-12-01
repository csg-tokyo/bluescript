import { execSync } from 'child_process'
import { compileAndRun, compileAndRunWithSingleFile, multiCompileAndRun } from './test-code-generator'
import { describe, expect, test, beforeAll } from '@jest/globals'

beforeAll(() => {
  execSync('mkdir -p ./temp-files')
})

test('simple code', () => {
  const src = 'print(1 + 1)'

  expect(compileAndRun(src)).toEqual('2\n')
})

test('string concatenation is not available', () => {
  const src = 'print("foo" + 1)'    // + is available only for numbers

  expect(() => { compileAndRun(src) }).toThrow(/invalid operands to +/)
})

test('boolean conditions', () => {
  const src = `
    function foo(n: integer) {
      let b = true; let j = 3
      while (b) {
        if (j-- < 0)
          b = false
        else if (j < -10) {
          print(100)
          print(j); return
          let str: any = null
          let k = str + 1
        }
      }

      let c: any = 3
      while (c)
        if (c-- < 0)
          b = null
        else if (c < -10) {
          let str: any = null
          let k = str + 1
        }

      c = 3
      while (c)
        if (c-- < 0)
          b = false
        else if (c < -10) {
          let str: any = null
          let k = str + 1
        }

      c = 3
      while (c)
        if (c-- < -10) {
          let str: any = null
          let k = str + 1
        }

      c = 3.0
      while (c)
        if (c-- < -10) {
          let str: any = null
          let k = str + 1
        }
    }
    foo(3)
`
  expect(compileAndRun(src)).toEqual('')
})

test('literals', () => {
  const src = `
  function foo(n: integer) {
    const empty = null
    const i = n
    const f = 7.4
    const b1 = true
    const b2 = false
    const str = 'test'
    print(empty)
    print(i)
    print(f)
    print(b1)
    print(b2)
    print(str)
    return
  }
  foo(33)
  `
  expect(compileAndRun(src)).toBe('null\n33\n7.400000\n1\n0\ntest\n')
})

test('undefined', () => {
  const src = 'const k = undefined'
  expect(() => { compileAndRun(src) }).toThrow(/unknown name: undefined/)
})

test('control structuers', () => {
  const src = `
  function foo(n: integer): integer {
    let sum = 0, c = n
    while (c-- > 0)
      sum += c
    for (let i = 0; i < n; i++)
      sum += i
    let j: integer
    for (j = 0; j < n; ++j)
      sum += j

    if (sum > 10)
      sum += 1

    return sum
  }
  print(foo(5))
  `
  expect(compileAndRun(src)).toBe('31\n')
})

test('empty loop body', () => {
  const src = `
  function foo(n: integer): integer {
    let c = n
    while (c-- > 0)
      ;
    c = n
    while (c-- > 0) {}
    for (let i = 0; i < n; i++)
      ;
    for (let i = 0; i < n; i++) {}
    if (n > 10)
      ;
    else
      ;

    if (n > 10) {} else {}
    return n
  }
  print(foo(5))
  `
  expect(compileAndRun(src)).toBe('5\n')
})

test('for loops', () => {
  const src = `
  function foo(n: integer): integer {
    let sum = 0, i = 1
    for (++i; i < n; i++)
      sum += i
    let j = 0
    for (;;)
      if (j++ > n)
        break
      else {
        sum += j
        continue
      }

    return sum
  }
  print(foo(5))
  `
  expect(compileAndRun(src)).toBe('30\n')
})


test('return statements', () => {
  const src = `
function foo(n: integer): void {
  if (n > 0) {
    print(n)
    return
  }
  else {
    print(-n)
    return
  }
}

function  bar(n: integer): integer {
  if (n > 0)
    return n + 1

  return -n + 10
}

function baz(n: integer): any {
  if (n > 0)
    return n + 1
  else
    return -n + 10
}

foo(3)
foo(-5)
print(bar(7))
print(bar(-9))
print(baz(2))
print(baz(-3))
  `
  expect(compileAndRun(src)).toBe('3\n5\n8\n19\n3\n13\n')
})

test('bad return statement', () => {
  const src = `
  function foo(n: integer): integer {
    print(33)
    return
  }
  print(foo(3))
`
  expect(() => { compileAndRun(src) }).toThrow(/non-void function must return/)
})

test('void function without a return value', () => {
  const src = `
  function foo(n: integer): integer {
    print(33)
  }
  print(foo(3))
`
  expect(() => { compileAndRun(src) }).toThrow(/non-void function must return/)
})

test('convert void to any', () => {
  const src = `
  function foo(n: integer) {
    print(33)
  }
  print(foo(3))
`
  expect(() => { compileAndRun(src) }).toThrow(/void to any/)
})

test('declarations', () => {
  const src = `
  function foo(n: integer) {
    let f: float
    const k = 3, m = 7
    f = k + m
    return f + n
  }
  print(foo(3))
`
  expect(compileAndRun(src)).toBe('13.000000\n')
})

test('const declaration', () => {
  const src = `
  function foo(n: integer) {
    const k = 7
    k += n
    return k
  }
  print(foo(k))
`
  expect(() => { compileAndRun(src) }).toThrow(/assignment to constant/)
})

test('string declaration', () => {
  const src = `
  function foo(n: float) {
    const k = n, m = k
    const str = 'foo', str2 = 'bar'
    print(str)
    print(m)
    print(str2)
  }
  foo(3)
  `

  expect(compileAndRun(src)).toBe("foo\n3.000000\nbar\n")
})

test('mixed type declaration', () => {
  const src = `
  function foo(n: integer) {
    const k = 7, m = 'foo'   // error
    return k + n
  }
  print(foo(8))
`
  expect(() => { compileAndRun(src) }).toThrow(/mixed-type declaration/)
})

test('duplicated declaration', () => {
  const src = `
  let k = 3;
  let k = true;
`
  expect(() => { compileAndRun(src) }).toThrow(/has already been declared/)
})

test('const assignment', () => {
  const src = `
  let k = 3
  k = 7
  const j = true
  j = false
`
  expect(() => { compileAndRun(src) }).toThrow(/assignment to constant.*5/)
})

test('fact function', () => {
  const src = `
  function fact(n: integer) {
    if (n == 0)
      return 1
    else
      return n * fact(n - 1)
  }
  print(fact(4))`

  expect(compileAndRun(src)).toBe('24\n')
})

test('runtime type checking', () => {
  const src = `function foo(n: any) { return n + 1 }
  print(foo(3))
  `
  expect(compileAndRun(src)).toEqual('4\n')

  const src2 = `function foo(n: any) { return n + 1 }   // runtime type error
  print(foo('foo'))
  `
  expect(() => { compileAndRun(src2) }).toThrow(/runtime type error: bad operand for +/)

  const src3 = `function foo(n: integer) { return n + 1 }
  print(foo(4.7 as integer))
  `
  expect(compileAndRun(src3)).toEqual('5\n')

  const src35 = `function foo(n: integer) { return n + 1 }
  print(foo(4.7))
  `
  expect(() => { compileAndRun(src35) }).toThrow(/incompatible argument.*float to integer/)

  const src37 = `function foo(n: integer) {
    const i: any = n
    const f: float = i
    const f2: float = i + 3.5
    const f3: float = n + 1.2
    return f + f2 + f3
  }
  print(foo(4))
  `
  expect(compileAndRun(src37)).toBe('16.699997\n')

  const src4 = `function foo(n: integer) { return n + 1 }
  print(foo())
  `
  expect(() => { compileAndRun(src4) }).toThrow(/wrong number of arguments/)

  const src5 = `function foo(n: integer) { return n + 1 }
  print(foo(1, 3))
  `
  expect(() => { compileAndRun(src5) }).toThrow(/wrong number of arguments/)
})

test('multiple source files', () => {
  const src1 = `function foo(n: integer) { return n + 1 }
let k = 3
const str = 'test'
`
  const src2 = `function bar(n: integer) {
    return n + k
  }
print(foo(7))
print(bar(10))
k = 7
print(bar(10))
print(str)
`
  expect(multiCompileAndRun(src1, src2)).toEqual('8\n13\n17\ntest\n')
})

test('redeefine a global variable', () => {
  const src1 = 'let k = 3'

  const src2 = `let k = true
`
  expect(() => { multiCompileAndRun(src1, src2) }).toThrow(/already been declared/)
})

test('redeefine a global variable after using it', () => {
  const src1 = 'let k = 3'

  const src2 = `function bar(n: integer) {
    return n + k
  }
let k = true
`
  expect(() => { multiCompileAndRun(src1, src2) }).toThrow(/already been declared/)
})

test('forward reference to a global variable', () => {
  const src1 = 'let j = 3'

  const src2 = `function bar(n: integer) {
    return n + k + j
  }
let k = 10
print(bar(100))
`
  expect(multiCompileAndRun(src1, src2)).toBe('113\n')
})

test('bad duplicted function declarations', () => {
  const src1 = 'function foo(a: number): number { return a + 1 }'

  const src2 = `function foo(n: integer): string {
    return 'test'
  }

print(foo(100))
`
  expect(() => { multiCompileAndRun(src1, src2) }).toThrow(/declared again with a different type/)
})

test('duplicted function declarations', () => {
  const src1 = `function foo(a: number): number { return a + 1 }
print(foo(10))`

  const src2 = `function foo(n: integer): number {
    return n + 2
  }
print(foo(10))
`
  expect(multiCompileAndRun(src1, src2)).toBe('11\n12\n')
})

test('a function is a value', () => {
  const src1 = 'function foo(n: integer) { return n }'

  const src2 = `function bar(n: integer) {
    const f = foo
    const g: (n: integer) => integer = foo
    return f(n) + g(11)
  }

  function foo2() {
    return foo
  }

  function baz(n: integer) {
    return foo2()(n)
  }
print(bar(101))
print(baz(13))
`
  expect(multiCompileAndRun(src1, src2)).toBe('112\n13\n')
})

test('a nested function', () => {
  const src = `function foo(n: any) {
    function bar(n: integer) { return n }
    return bar(n)
  }
  print(foo(3))
  `
  expect(() => compileAndRun(src)).toThrow(/nested function.*line 2/)
})

test('function redefinition', () => {
  const src = `function foo(n: any) {
    return n + 1
  }
  foo = (n: any) => n
  print(foo(3))
  `
  expect(() => compileAndRun(src)).toThrow(/assignment to top-level function.*line 4/)
})

test('conversion between any-types and function types', () => {
  const src = `
  function foo(n: integer) {
    return n
  }

  function bar(n: integer) {
    const f: any = foo
    const g: (x: integer) => integer = f
    return g(n)
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('3\n')
})

test('wrong conversion from any-types to function types', () => {
  const src = `
  function foo(n: integer) {
    return n
  }

  function bar(n: integer) {
    const f: any = foo
    const g: (x: integer, y: integer) => integer = f  // runtime error
    return g(n, n)
  }

  print(bar(3))`

  expect(() => { compileAndRun(src) }).toThrow(/value_to_function/)

  const src2 = `
  function bar(n: integer) {
    const f: any = "foo"
    const g: (x: integer, y: integer) => integer = f  // runtime error
    return g(n, n)
  }

  print(bar(3))`

  expect(() => { compileAndRun(src2) }).toThrow(/value_to_function/)
})

test('arrow function', () => {
  const src = `
  const foo = (n: integer) => { return n }
  let bar = (n: integer) => { return n * 10 }
  let bar2 = (n: any) => { return n }
  let bar3 = (a: any, b: integer):any => { return a + b }
  let baz = n => bar3(bar2(n), 1)

  function func(n: integer) {
    return foo(n) + bar(n) + baz(n)
  }

  print(func(3))`

  expect(compileAndRun(src)).toBe('37\n')
})

test('redefinition of a const function', () => {
  const src1 = 'const foo = (a: number): number => a + 1'

  const src2 = `foo = (n: integer): integer => n

print(foo(100))
`
  expect(() => { multiCompileAndRun(src1, src2) }).toThrow(/assignment to constant variable.*line 1/)
})

test('calling a const function', () => {
  const src = `
  function fib(i: integer): integer {
    if (i < 2)
      return 1
    else
      return fib(i - 1) + fib(i - 2)
  }

  const fib_fast = (i: integer): integer => {
    if (i < 2)
      return 1
    else
      return fib_fast(i - 1) + fib_fast(i - 2)
  }

  const t0 = performance_now()
  fib(40)
  const t1 = performance_now()
  fib_fast(40)
  const t2 = performance_now()
  print(t1 - t0)
  print(t2 - t1)
  print('result')
  print(t1 - t0 > t2 - t1)`

  expect(compileAndRun(src)).toMatch(/result\n1/)
})

test('an arrow function cannot capture a local variable', () => {
  const src = `
  function foo(n) {
    const k = n + 1
    return (i: number) => { return k }
  }
  `

  expect(() => { compileAndRun(src) }).toThrow(/not accessible.*arrow.*line 4/)
})

test('unary operator', () => {
  const src = `
  function foo(n: integer) {
    const i: any = n
    const f: float = n
    print(+n)
    print(-n)
    print(!n)
    print(~n)
    print(+i)
    print(-i)
    print(!i)
    print(~i)
    print(+f)
    print(-f)
    print(!f)
  }
  foo(3)
`
  expect(compileAndRun(src)).toBe('3\n-3\n0\n-4\n3\n-3\n0\n-4\n3.000000\n-3.000000\n0\n')
})

test('typeof operator', () => {
  const src = `
  function foo(x: any) { return x + 1 }
  print(typeof(3))
  print(typeof(2 + 3))
  print(typeof('foo'))
  print(typeof([1, 2, 3]))
  print(typeof(null))
  print(typeof(foo))
  `
  expect(compileAndRun(src)).toBe('integer\ninteger\nstring\ninteger[]\nnull\nany => any\n')
})

test('++/-- operator', () => {
  const src = `
  function foo(n: integer) {
    let i: any = n
    print(++n)
    print(--n)
    print(n++)
    print(n--)
    print(n)
    print(++i)
    print(--i)
    print(i++)
    print(i--)
    print(i)
  }
  foo(5)
`
  expect(compileAndRun(src)).toBe('6\n5\n5\n6\n5\n6\n5\n5\n6\n5\n')
})

test('++ operator for const', () => {
  const src = `
  function foo(n: integer) {
    const i = n
    print(++i)
    print(i--)
  }
  foo(5)
`
  expect(() => compileAndRun(src)).toThrow(/assignment to constant.*line 4.*\n.*line 5/)
})

test('++ operator for arrays', () => {
  const src = `
  function foo(n: integer[], m: any[]) {
    print(++n[0])
    print(n[0]--)
    print(n[0])
    print(m[0]++)
    print(m[0])
  }
  foo([3, 2], [7, 'foo'])
`
  expect(compileAndRun(src)).toBe('4\n4\n3\n7\n8\n')
})

test('equality operators', () => {
  const src = `
  function foo(m: integer, n: float) {
    print(m === n)
    print(m == n)
    print(m !== n)
    print(m != n)
  }
  foo(5, 5.0)
`
  expect(compileAndRun(src)).toBe([1, 1, 0, 0].join('\n') + '\n')
})

test('boolean equality', () => {
  const src = `
  function foo(m: integer, n: integer) {
    print(m < n === true)
    print(m < n === false)
    print(m < n !== true)
    print(m < n !== false)
    if ((m === n) === true)
      print(m < n)
    if (m !== n)
      print(m >= n)
  }
  foo(5, 7)
`
  expect(compileAndRun(src)).toBe([1, 0, 0, 1, 0].join('\n') + '\n')
})

test('basic binary operators', () => {
  const src = `
  function foo(m: integer, n: float) {
    print(m + n)
    print(m * n)
    print(m > n)
    print(m >= n)
    const a = m
    const b = n
    print(a - n)
    print(m / b)
    print(a < b)
    print(a <= n)
  }
  foo(5, 3.0)
`
  expect(compileAndRun(src)).toBe(['8.000000', '15.000000', 1, 1, '2.000000', 1.666667, 0, 0].join('\n') + '\n')
})

test('integer binary operators', () => {
  const src = `
  function foo(m: integer, n: integer) {
    print(m | n)
    print(m ^ n)
    print(m & n)
    print(m % n)
    print(m << n)
    print(m >> n)
    print(m >>> n)
  }
  foo(511, 2)
  print_i32(0xff00ff21 >>> 2)
  print_i32((0xff00ff21 as integer) >> 2)
  print_i32(-5 >>> 2)
  print_i32(-5 >> 2)
`
  expect(compileAndRun(src)).toBe([511, 509, 2, 1, 2044, 127, 127, 1069563848, -4177976, 1073741822, -2].join('\n') + '\n')
})

test('int % float is not valid', () => {
  const src = `
  function foo(m: integer, n: float) {
    print(m % n)
  }
  foo(5, 3.0)
`
  expect(() => { compileAndRun(src) }).toThrow(/invalid operands.*line 3/)
})

test('assignment', () => {
  const src = `
  function foo(x: integer, s: string) {
    let y
    const a = x
    let b: any = x
    y = x
    print(b + y)
    b = s
    print(b)
  }
  foo(7, 'test')
  `

  expect(compileAndRun(src)).toBe([14, 'test'].join('\n') + '\n')
})

test('assignment from any', () => {
  const src = `
  function foo(i, str) {
    const j: integer = i
    const s: string = str       // cast??
    print(j)
    print(s)
  }
  foo(7, 'test')
  `

  expect(compileAndRun(src)).toBe([7, 'test'].join('\n') + '\n')
})

test('any to null', () => {
  const src = `
  function foo(obj: any) {
    const s: null = obj
    return s
  }
  print(foo(null))
  `

  expect(compileAndRun(src)).toBe('null\n')
})

test('null to any or string', () => {
  const src = `
  function foo(obj: any) {
    obj = null
    return obj
  }
  print(foo(3))
  `

  const src2 = `
  function foo(obj: string) {
    obj = null  // type error
    return obj
  }
  `

  expect(compileAndRun(src)).toBe('null\n')
  expect(() => compileAndRun(src2)).toThrow(/not assignable.*line 3/)
})

test('wrong assignment from any', () => {
  const src = `
  function foo(obj: any) {
    const s: string = obj
  }
  print(0)
  foo('test')
  foo([1, 2])
  `

  expect(() => compileAndRun(src)).toThrow(/runtime type error: value_to_string/)
})

test('+= operator', () => {
  const src = `
  function foo(obj: any, n: integer): integer {
    obj += n
    print(obj)
    n += obj
    print(n)
    obj += obj
    return obj
  }
  print(foo(7, 3))
  `

  expect(compileAndRun(src)).toBe([10, 13, 20].join('\n') + '\n')
})

test('%=, <<=, and >>= operator', () => {
  const src = `
  function foo(obj: any, n: integer) {
    let k = 10
    k %= n
    k <<= 2
    print(k)
    let m = -4
    m >>= 1
    print(m)
    let p: any = -4
    return (p as integer) >> 1
  }
  print(foo(7, 3))
  `

  expect(compileAndRun(src)).toBe([4, -2, -2].join('\n') + '\n')
})

test('logical operator', () => {
  const src = `
  function foo(obj: any, n: integer, m: integer): boolean {
    const b = obj == null && !obj
    print(b)
    const b2 = 1 < m && m < 3
    print(b2)
    return obj
  }
  print(foo(null, 0, 2))
  `

  expect(compileAndRun(src)).toBe([1, 1, 0].join('\n') + '\n')
})

test('conditional operator', () => {
  const src = `
  function foo(obj: string, n: integer): string {
    return n > 0 ? obj : 'baz'
  }
  print(foo('bar', 1))
  print(foo('bar2', 0))
  `

  expect(compileAndRun(src)).toBe(['bar', 'baz'].join('\n') + '\n')
})

test('function call', () => {
  const src = `
  function foo() {
    return k
  }
  let k = 7

  function bar(n: number) {
    return n
  }

  function bar2(n: integer, f: float) {
    return n + f
  }

  function baz(a: any, b: integer[], c: integer, d: string) {
    print(a)
    print(b[0])
    print(d)
    return c
  }

  print(foo())
  print(bar(3))
  print(bar2(7, 0.4))
  print(baz(null, [1, 2], 11, 'baz2'))
  `

  expect(compileAndRun(src)).toBe([7, 3, '7.400000', 'null', 1, 'baz2', 11].join('\n') + '\n')
})

test('array access', () => {
  const src = `
  function foo(n: integer): integer {
    const s = [ n ]
    return s[0] + 3
  }
  function bar(s: string): string {
    const a = [ s ]
    return a[0]
  }
  print(foo(4))
  print(bar('test'))`

  expect(compileAndRun(src)).toBe('7\ntest\n')
})

test('bad value assignment to an int array', () => {
  const src = `
  function foo(n: integer): integer {
    const s = [ n ]
    s[0] = "foo"     // type error
    return s[0] + 3
  }

  print(foo(4))`

  expect(() => { compileAndRun(src) }).toThrow(/not assignable to element type/)
})

test('bad value assignment to a string array', () => {
  const src = `
  function foo(n: string): string {
    const s = [ n ]
    s[0] = 33     // type error
    return s[0]
  }

  print(foo('test'))`

  expect(() => { compileAndRun(src) }).toThrow(/not assignable to element type/)
})

test('any-type array', () => {
  const src = `
  function foo(n: integer): integer {
    const arr = [ n ]
    // const s: any[] = (arr as any)             // int[] as any (error)
    const s2: any = arr                       // any = integer[]
    const t1: integer[] = arr
    const t2: integer[] = (arr as integer[])
    const arr2: any[] = [ 1, "foo" ]
    const u: any = arr2
    const u2: any = arr2 as any               // any[] as any
    const u3: any[] = u2
    const u4: any[] = u2 as any[]             // any as any[]
    // const u5: integer[] = u2                  // (error)
    // const u6: integer[] = u2 as integer[]     // any as integer[] (error)
    return arr[0]
  }
  print(foo(4))`

  expect(compileAndRun(src)).toBe('4\n')

  const src2 = `
  function foo(n: integer): integer {
    const arr = [ n ]
    const s: any[] = (arr as any)             // int[] as any (error)
    return n
  }
  print(foo(4))
  `
  expect(() => compileAndRun(src2)).toThrow(/runtime type error/)
})

test('any-type array 2', () => {
  const src = `
  function foo(n: string): string {
    const arr = [ n ]
    const s2: any = arr                       // any = string[]
    const t1: string[] = arr
    const t2: string[] = (arr as string[])
    const arr2: any[] = [ 1, "foo" ]
    const u: any = arr2
    const u2: any = arr2 as any               // any[] as any
    return arr[0]
  }
  print(foo('test'))`

  expect(compileAndRun(src)).toBe('test\n')

  const src2 = `
  function foo(n: string): string {
    const arr = [ n ]
    const s: any[] = (arr as any)    // string[] as any (error)
    return arr[0]
  }
  print(foo('test'))`

  expect(() => compileAndRun(src2)).toThrow(/runtime type error: Array\<any\>/)
})

test('any-type array element', () => {
  const src = `
  function foo(n: integer): integer {
    const arr: any[] = [ n, 'foo' ]
    const h: float = 3.7
    arr[0] = n + 1
    arr[1] = true
    arr[1] = h
    let k: any
    k = n
    k = h
    k = false
    return arr[0]
  }
  print(foo(4))`

  expect(compileAndRun(src)).toBe('5\n')
})

test('+= for int array', () => {
  const src = `
  function foo(n: integer): integer {
    const arr: any[] = [ n, 'foo', 10 ]
    const iarr: integer[] = [1, 2, 3]
    const k: any = 7
    arr[0] += n
    print(arr[0])       // 20
    let p = arr[0] -= 1
    p = 'foo'
    print(arr[0])       // 19
    arr[2] += k
    print(arr[2])       // 17
    print(iarr[0] + 20) // 21
    iarr[0] += n
    iarr[1] -= n
    print(iarr[0])      // 11
    print(iarr[1])      // -8
    iarr[2] *= iarr[0] + iarr[1]
    print(iarr[2])      //  9
    iarr[2] -= k
    return iarr[2]       // 2
  }
  print(foo(10))`

  expect(compileAndRun(src)).toBe([20, 19, 17, 21, 11, -8, 9, 2].join('\n') + '\n')
})

test('+= for float array', () => {
  const src = `
  function foo(n: float): float {
    const arr: any[] = [ n, 'foo', 10.5 ]
    const iarr: float[] = [1.5, 2.5, 3.5]
    const k: any = 7.5
    arr[0] += n
    print(arr[0])       // 21.0
    let p = arr[0] -= 1.5
    p = 'foo'
    print(arr[0])       // 19.5
    arr[2] += k
    print(arr[2])       // 18.0
    print(iarr[0] + 20.1) // 21.6
    iarr[0] += n
    iarr[1] -= n
    print(iarr[0])      // 12.0
    print(iarr[1])      // -8.0
    iarr[2] *= iarr[0] + iarr[1]
    print(iarr[2])      //  14.0
    iarr[2] -= k
    return iarr[2]       // 6.5
  }
  print(foo(10.5))`

  expect(compileAndRun(src)).toBe('21.000000\n19.500000\n18.000000\n21.599998\n12.000000\n-8.000000\n14.000000\n6.500000\n')
})

test('int array assignment', () => {
  const src = `
function func1(data: integer[]) {
	let arr2: integer[] = [2, 3, 40]

	arr2[0] = data[0]
  arr2[2] += 10.5
	let v: integer = arr2[0] * 2
  return v + arr2[2]
}

const arr = [1, 2, 3]
print(func1(arr))
`

  expect(compileAndRun(src)).toBe('52\n')
})

test('float array assignment', () => {
  const src = `
function func1(data: float[]) {
	let arr2: float[] = [2.0, 3.0, 4.0]

  const f = data[1]
  print(f)
	arr2[0] = data[0]
	let v: integer = (arr2[0] * 2) as integer
  return v
}

const arr = [1.5, 2.5, 3.5]
print(func1(arr))
`

  expect(compileAndRun(src)).toBe('2.500000\n3\n')
})

test('new Array(n)', () => {
  const src = `
  function foo(n: integer, m: any) {
    const a1 = new Array(n)
    a1[0] = 22
    const a2 = new Array(m)
    a2[0] = 77
    return a1[0] + a2[0]
  }

  print(foo(3, 4))`

  expect(compileAndRun(src)).toBe('99\n')
})

test('new Array<integer>(n)', () => {
  const src = `
  function foo(n: integer, m: any) {
    const a1 = new Array<integer>(n)
    a1[0] = 22
    const a2 = new Array<integer>(m)
    a2[0] = 77
    return a1[0] + a2[0]
  }

  print(foo(3, 4))`

  expect(compileAndRun(src)).toBe('99\n')
})

test('new Array<integer>(n, v)', () => {
  const src = `
  function foo(n: integer) {
    const a1 = new Array<integer>(n, 7)
    return a1[0] + a1[n - 1]
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('14\n')
})

test('new Array<integer>(n, v: any)', () => {
  const src = `
  function foo(n: integer) {
    const i: any = 7
    const a1 = new Array<integer>(n, i)
    return a1[0] + a1[n - 1]
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('14\n')
})

test('new Array<float>(n)', () => {
  const src = `
  function foo(n: integer, m: any) {
    const a1 = new Array<float>(n)
    a1[n - 1] = 22.3
    const a2 = new Array<float>(m)
    a2[m - 1] = 77.4
    return a1[n - 1] + a2[m - 1]
  }

  print(foo(3, 4))`

  expect(compileAndRun(src)).toBe('99.699982\n')
})

test('new Array<float>(n, v)', () => {
  const src = `
  function foo(n: integer) {
    const a1 = new Array<float>(n, 7.2)
    return a1[0] + a1[n - 1]
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('14.399998\n')
})

test('new Array<float>(n, v: any)', () => {
  const src = `
  function foo(n: integer) {
    const i: any = 7.2
    const a1 = new Array<float>(n, i)
    const m: any = n
    const a2 = new Array<float>(m, i)
    return a1[0] + a2[n - 1]
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('14.399998\n')
})

test('boolean array', () => {
  const src = `
  function foo() {
    const a1 = [true, false, true]
    print(a1[0])
    print(a1[1])
    return a1[2]
  }

  print(foo())`

  expect(compileAndRun(src)).toBe('1\n0\n1\n')
})

test('new Array<boolean>(n)', () => {
  const src = `
  function foo(n: integer, m: any) {
    const a1 = new Array<boolean>(n)
    a1[n - 1] = true
    const a2 = new Array<boolean>(m)
    a2[m - 1] = true
    print(a1[0])
    print(a1[n - 1])
    return a1[n - 1] && a2[m - 1]
  }

  print(foo(3, 4))`

  expect(compileAndRun(src)).toBe('0\n1\n1\n')
})

test('new Array<boolean>(n, v)', () => {
  const src = `
  function foo(n: integer) {
    const a1 = new Array<boolean>(n, true)
    return a1[0] && a1[n - 1]
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('1\n')
})

test('new Array<boolean>(n, v: any)', () => {
  const src = `
  function foo(n: integer) {
    const i: any = true
    const a1 = new Array<boolean>(n, i)
    const m: any = n
    const a2 = new Array<boolean>(m, i)
    return a1[0] && a2[n - 1]
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('1\n')
})

test('new Array<string>(n)', () => {
  const src = `
  function foo(n: integer) {
    const a1 = new Array<string>(n, '')
    print(typeof a1)
    a1[0] = 'foo'
    return a1[0]
  }

  print(foo(3))`

  expect(compileAndRun(src)).toBe('string[]\nfoo\n')
})

test('new Array<string>(n, null)', () => {
  const src = `
  function foo(n: integer) {
    const a1 = new Array<string>(n, null)
    print(typeof a1)
    a1[0] = 'foo'
    return a1[0]
  }

  print(foo(3))`

  expect(() => compileAndRun(src)).toThrow(/incompatible argument.*line 3/)
})

test('2d float array', () => {
  const src = `
  let farray1 = [0.1, 0.2, 0.3];
  let farray2 = [1.1, 1.2, 1.3];
  let farray12 = [farray1, farray2];
  let f = farray12[0][1];
  print(f)
  const arr = new Array<float[]>(4, [0.2])
  print(arr[3][0])
`
  expect(compileAndRun(src)).toBe('0.200000\n0.200000\n')
})

test('2d string array', () => {
  const src = `
  let sarray1 = ['a', 'b', 'c'];
  let sarray2 = ['x', 'y', 'z'];
  let sarray12 = [sarray1, sarray2];
  print(sarray12[0][1]);
  sarray12[0][1] = 'd';
  print(sarray12[0][1]);
  const arr = new Array<string[]>(4, ['a']);
  print(arr[3][0]);
`
  expect(compileAndRun(src)).toBe('b\nd\na\n')
})

test('convert an any-type value to an array', () => {
  const src = `
  function foo(n: integer) {
    const arr1a: any = new Array<integer>(n)
    const arr2a: any = new Array<float>(n)
    const arr3a: any = new Array<boolean>(n)
    const arr4a: any = new Array<string>(n, 'foo')
    const arr5a: any = new Array(n)
    const arr1: integer[] = arr1a
    const arr2: float[] = arr2a
    const arr3: boolean[] = arr3a
    typeof arr4a
    const arr5: any[] = arr5a
    const arr4: string[] = arr4a
    print(arr1[0])
  }
  foo(3)
  `
  expect(() => compileAndRun(src)).toThrow(/cannot convert any to string\[\]/)
})

test('class declaration', () => {
  const src = `
  class Position {
    x: integer
    y: integer
    xmove(dx: integer) {}
  }
  `
  const src2 = `
  class BrokenPos {
    x: integer
    x: string
  }
  `

  expect(compileAndRun(src)).toBe('')
  expect(() => { compileAndRun(src2)}).toThrow(/duplicate property name.*line 4/)
})

test('make an instance', () => {
  const src = `
  class Pos {
    x: integer
    y: integer
  }

  const obj = new Pos()
  print(obj.x + obj.y)
  obj.x = 3
  obj.y = 10
  print(obj.x + obj.y)
  `

  expect(compileAndRun(src)).toBe('0\n13\n')
})

test('make an instance holding a string etc.', () => {
  const src = `
  class Pos {
    x: integer
    str: string
    arr: integer[]
    constructor() { this.x = 3 }
  }

  const obj = new Pos()
  const k = obj.x = 40
  print(typeof(k))
  obj.str = 'foo'
  obj.arr = [1, 2, 3]
  print(obj.str)
  print(obj.x + obj.arr[2])
  `

  expect(compileAndRun(src)).toBe('any\nfoo\n43\n')
})

test('class with a constructor', () => {
  const src = `
  class Pos {
    x: integer
    y: integer
    str: string
    constructor(x: number, str: string) { this.x = x; this.y = 0; this.str = str }
  }

  const obj = new Pos(3, 'foo')
  print(obj.x)
  `

  expect(compileAndRun(src)).toBe('3\n')
})

test.only('class with a super constructor', () => {
  const src = `
  class Pos {
    x: integer
    y: integer
    constructor(x: number) { this.x = x; this.y = 0 }
  }

  class Pos3 extends Pos {
    z: integer
    constructor() {
      // super(1)
      this.z = 3
    }
  }

  const obj = new Pos3()
  print(obj.z)
  `

  expect(compileAndRun(src)).toBe('3\n')
})

test('save arguments into rootset', () => {
  const src = `
  function foo(n: integer) {
    const arr1 = new Array(n, 'foo')
    const str = 'baz'
    const arr2 = [ 3, arr1, true, 'bar', str ]
    print(arr1[n - 1])
    print(arr2[3])
  }
  foo(3)
  `
  expect(compileAndRun(src)).toBe('foo\nbar\n')
})

test('built-in functions are not used', () => {
  const src = `
  function foo(n: integer) {
    return n + 1
  }
  foo(3)`

  expect(compileAndRun(src)).toBe('')
})

test('performance_now()', () => {
  const src = `
  function fib(i: integer): integer {
    if (i < 2)
      return 1
    else
      return fib(i - 1) + fib(i - 2)
  }
  const t0 = performance_now()
  fib(40)
  print(performance_now() - t0)`

  expect(compileAndRun(src)).toMatch(/[0-9]+\n/)
})

test('native code', () => {
  const src = `
code\`#include <math.h>\`

function sqrt(x: float): float {
  let r: float
  code\`_r = sqrt(_x)\`
  return r
}

print(sqrt(9.0))
`

  expect(compileAndRun(src)).toBe('3.000000\n')
})

test('name scope', () => {
  const src = `
  function func1() {
    let result = "sss"
    let e = 30
    e += d      // d is a forward reference
    print(result)
    return e
  }
  
  const d = 1
  const e = 6
  print(e)
  let result = 4
  print(result)
  print(func1())
  print(result)
  print(e)`

  expect(compileAndRun(src)).toBe([6, 4, 'sss', 31, 4, 6].join('\n') + '\n')
})

test('forward reference to a global variable', () => {
  const src = `
function foo(v: integer) {
  // arr is declared later.  So, on the first pass, arr is typed as any.
  const arr2 = arr
  return arr[v] + arr2[v] + bar(arr)
}

function bar(a: integer[]) {
  return a[1]
}

let arr: integer[] = [3, 70, 0, 0, 0, 0];
print(foo(0))`

  expect(compileAndRun(src)).toBe('76\n')
})
