import { describe, expect, test } from '@jest/globals'
import { transpile } from "../../src/transpiler/code-generator/code-generator";
import { runBabelParser, ErrorLog } from "../../src/transpiler/utils";

test("transpile", () => {
  const tsString = "let i:integer = 3;";
  const expectedCString = "int32_t _i;";
  const result = transpile(1, tsString);
  expect(result.code.split('\n')[0]).toBe(expectedCString);
})

test("playground", () => {
  const tsString = "1 + 1";

  try {
    const result1 = transpile(1, 'const arr1 = [1, 2]; const f: float = 3.0;');
    const result2 = transpile(2, tsString, result1.names);
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
