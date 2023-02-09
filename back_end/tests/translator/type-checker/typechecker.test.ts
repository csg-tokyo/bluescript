import {transpile} from "../../../src/translator/type-checker/transpile";
import {getStaticType, GlobalNameTable, Typechecker} from "../../../src/translator/type-checker/typechecker";
import * as visitor from "../../../src/translator/type-checker/visitor"

describe('test1', () => {

  test("transpile", () => {
    const tsString = "1 + 1;";
    const ast = transpile(tsString);
    console.log(JSON.stringify(ast));
    const typechecker = new Typechecker();
    visitor.file(ast, new GlobalNameTable(), typechecker)
    console.log(JSON.stringify(typechecker));
    console.log(JSON.stringify(ast));
  })
});