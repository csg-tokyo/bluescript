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
function callFn(fn: ()=>void) {
  fn();
}

callFn(()=> {1 + 1});
`

test("playground", () => {
  try {
    const result1 = transpile(1, bsSrc1);

    console.log(result1.code);
  }
  catch (e) {
    if (e instanceof ErrorLog)
      console.log(e.toString());
    else
      throw e;
  }
})
