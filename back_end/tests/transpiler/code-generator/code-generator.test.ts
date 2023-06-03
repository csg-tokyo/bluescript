import { compileAndRun } from './test-code-generator'

test('simple code', () => {
  const src = 'print(1 + 1)'

  expect(compileAndRun(src)).toEqual('2\n')
})

test('runtime type checking', () => {
  const src = `function foo(n: any) { return n + 1 }
  print(foo(3))
  `
  expect(compileAndRun(src)).toEqual('4\n')

  const src2 = `function foo(n: any) { return n + 1 }
  print(foo('foo'))
  `
  expect(() => { compileAndRun(src2) }).toThrow(/runtime type error: bad operand for +/)
})

test('string concatenation', () => {
  const src = 'print("foo" + 1)'

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
    s[0] = "foo"
    return s[0] + 3
  }

  print(foo(4))`

  expect(() => { compileAndRun(src) }).toThrow(/not assignable to element type/)
})