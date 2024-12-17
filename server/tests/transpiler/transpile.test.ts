import { describe, expect, test } from '@jest/globals'
import { transpile } from "../../src/transpiler/code-generator/code-generator";
import { runBabelParser, ErrorLog } from "../../src/transpiler/utils";

test("transpile", () => {
  const tsString = "let i:integer = 3;";
  const expectedCString = "int32_t _i;";
  const result = transpile(1, tsString);
  expect(result.code.split('\n')[0]).toBe(expectedCString);
})

const bsSrc1 = `
function add(a:integer, b:integer) {
  return a + b;
}
`

const bsSrc2 = `
add(1, 2) + add(3, 4);
`

test("playground", () => {
  try {
    const result1 = transpile(1, bsSrc1);
    const result2 = transpile(2, bsSrc2, result1.names);
    const names = result2.names;
    const code = result2.code;

    console.log(names.lookup("arr"));
    console.log(code);
  }
  catch (e) {
    if (e instanceof ErrorLog)
      console.log(e.toString());
    else
      throw e;
  }
})
