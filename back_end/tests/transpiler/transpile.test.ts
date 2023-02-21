import {transpile} from "../../src/transpiler/transpile";
import {runBabelParser} from "../../src/transpiler/utils";
import * as visitor from "../../src/transpiler/visitor";
import TypeChecker from "../../src/transpiler/type-checker/type-checker";
import {FunctionType} from "../../src/transpiler/types";
import {GlobalNameTable} from "../../src/transpiler/type-checker/names";

test("transpile", () => {
  const tsString = "let i:integer = 3;";
  const expectedCString = "int32_t i = 3;\n\n";
  const result = transpile(tsString);
  expect(result).toBe(expectedCString);
})

// test("playground", () => {
//   const tsString = "let arr:integer[] = [3];";
//
//   const ast = runBabelParser(tsString, 1);
//   console.log(JSON.stringify(ast));
//
//   const globalNameTable = new GlobalNameTable()
//   globalNameTable.record("console_log_number", new FunctionType("void", ["integer"]));
//   v
//
//   console.log(JSON.stringify(typeChecker));
//   console.log(JSON.stringify(ast));
//   console.log(nameTable)
// })