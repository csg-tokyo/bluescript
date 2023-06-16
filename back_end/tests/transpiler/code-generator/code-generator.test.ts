import {compileAndRun, compileFileAndRun} from './test-code-generator'

test('simple code', () => {
  const src = 'print(1 + 1)'

  expect(compileAndRun(src)).toEqual('2\n')
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
})

test('string concatenation', () => {
  const src = 'print("foo" + 1)'    // + is available only for numbers

  expect(() => { compileAndRun(src) }).toThrow(/invalid operands to +/)
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

test('boolean conditions', () => {
  const src = `
    function foo(n: integer) {
      let b = true, j = 3
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
  expect(compileAndRun(src, 'foo.c')).toEqual('')
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
