import {transpile} from "../../src/transpiler/transpile";
import {runBabelParser} from "../../src/transpiler/utils";
import {runTypeChecker} from "../../src/transpiler/type-checker/type-checker";
import {GlobalNameTable, NameInfo} from "../../src/transpiler/type-checker/names";
import {CodeGenerator} from "../../src/transpiler/code-generator/code-generator";
import * as visitor from "../../src/transpiler/visitor";
import {GlobalRootSet} from "../../src/transpiler/code-generator/root-set";
import {ArrayType} from "../../src/transpiler/types";

test("transpile", () => {
  const tsString = "let i:integer = 3;";
  const expectedCString = "int32_t i = 3;\n\n";
  const result = transpile(tsString, []);
  expect(result).toBe(expectedCString);
})

test("playground", () => {
  const tsString = "arr1.foo;";

  const ast = runBabelParser(tsString, 1);
  console.log(JSON.stringify(ast));

  const globalNameTable = new GlobalNameTable();
  globalNameTable.record("arr1", new NameInfo(new ArrayType("integer")));
  globalNameTable.record("f", new NameInfo("float"));
  runTypeChecker(ast, globalNameTable);
  console.log(JSON.stringify(ast));

  const codeGenerator = new CodeGenerator();
  const rootSet = new GlobalRootSet(globalNameTable);

  visitor.file(ast, rootSet, codeGenerator);


  console.log(JSON.stringify(ast))
  console.log(globalNameTable.lookup("arr"))
  console.log(codeGenerator.result)
})