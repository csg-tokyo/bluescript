import {transpile} from "../../src/translator/transpile";
import {runBabelParser} from "../../src/translator/utils";
import {GlobalNameTable, Typechecker} from "../../src/translator/type-checker/typechecker";
import * as visitor from "../../src/translator/visitor";
import {CodeGenerator, RootSet} from "../../src/translator/code-generator/code-generator";

test("transpile", () => {
  const tsString = "let i:integer = 3;";
  const expectedCString = "int32_t i = 3;\n\n";
  const result = transpile(tsString);
  expect(result).toBe(expectedCString);
})

test("playground", () => {
  const tsString = "let s:string = 'Hello world';";

  const ast = runBabelParser(tsString);
  console.log(JSON.stringify(ast));

  const typechecker = new Typechecker();
  const nameTable = new GlobalNameTable();
  visitor.file(ast, nameTable, typechecker);

  console.log(JSON.stringify(ast));
})