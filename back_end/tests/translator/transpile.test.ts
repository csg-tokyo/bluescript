import {transpile} from "../../src/translator/transpile";
import {runBabelParser} from "../../src/translator/utils";
import {FunctionType, GlobalNameTable, Typechecker} from "../../src/translator/type-checker/typechecker";
import * as visitor from "../../src/translator/visitor";

test("transpile", () => {
  const tsString = "let i:integer = 3;";
  const expectedCString = "int32_t i = 3;\n\n";
  const result = transpile(tsString);
  expect(result).toBe(expectedCString);
})

test("playground", () => {
  const tsString = "let arr:integer[] = [3];";

  const ast = runBabelParser(tsString);
  console.log(JSON.stringify(ast));

  const typechecker = new Typechecker();
  const nameTable = new GlobalNameTable();
  nameTable.record("console_log_number", new FunctionType("void", ["integer"]));
  visitor.file(ast, nameTable, typechecker);

  console.log(JSON.stringify(typechecker));
  console.log(JSON.stringify(ast));
  console.log(nameTable)
})