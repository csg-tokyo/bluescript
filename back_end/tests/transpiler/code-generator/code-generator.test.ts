import { compileAndRun, multiCompileAndRun } from './test-code-generator'

test('simple code', () => {
  const src = 'print(1 + 1)'

  expect(compileAndRun(src)).toEqual('2\n')
})

test('string concatenation', () => {
  const src = 'print("foo" + 1)'    // + is available only for numbers

  expect(() => { compileAndRun(src) }).toThrow(/invalid operands to +/)
})

test('array access', () => {
  const src = `
  function foo(n: integer): integer {
    const s = [ n ]
    return s[0] + 3
  }
  print(foo(4))`

  expect(compileAndRun(src)).toBe('7\n')
})


test('bad value assignment to an array', () => {
  const src = `
  function foo(n: integer): integer {
    const s = [ n ]
    s[0] = "foo"     // runtime type error
    return s[0] + 3
  }

  print(foo(4))`

  expect(() => { compileAndRun(src) }).toThrow(/not assignable to element type/)
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
print(bar(101))
`
  expect(multiCompileAndRun(src1, src2)).toBe('112\n')
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
  expect(() => compileAndRun(src)).toThrow(/assignment to constant.*line 4\n.*line 5/)
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
  expect(compileAndRun(src, true, 'foo.c')).toBe([511, 509, 2, 1, 2044, 127, 127, 1069563848, -4177976, 1073741822, -2].join('\n') + '\n')
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

test('wrong assignment from any', () => {
  const src = `
  function foo(obj: any) {
    const s: string = obj
  }
  print(0)
  foo('test')
  foo([1, 2])
  `

  expect(() => compileAndRun(src)).toThrow(/value_to_string/)
})

