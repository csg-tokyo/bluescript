import * as tested from "../../../src/transpiler/transpile";

test('syntax error', () => {
  const src = `function foo(x: float) : number {
        return x + 1 k
    }`

  try {
    const ast = tested.transpile(src, 6)
  } catch (e: any) {
    const loc = e.messages[0].location.start
    expect(loc.line).toBe(7)
    expect(loc.column).toBe(20)
  }
})