import {replTranspile} from "../../src/transpiler/repl-transpile";
import {StaticType} from "../../src/transpiler/types";

test("repl-transpile", () => {
  const existingSymbol:{name: string, type: StaticType}[] = [
    {
      "name": "i",
      "type": "integer"
    },
    {
      "name": "s",
      "type": "string"
    },
  ]
  const tsString = `let f:float = 3.4;
  f * i;
  let s1:string = "Hello world!";`;
  const {cString, newSymbols, execFuncNames} = replTranspile(tsString, existingSymbol);

  const expectedCString = `float f;
void ___bluescript_exec_func_0() {
f = 3.4;
};
void ___bluescript_exec_func_1() {
f * i;
};
value_t s1;
void ___bluescript_exec_func_2() {
s1 = gc_new_string("Hello world!");
gc_array_set(gc_global_root_set_array, int_to_value(1), s1);
};

`;
  const expectedNewSymbols = [
    {
      "name": "f",
      "type": "float",
      "cDeclaration": "extern float f;",
    },
    {
      "name": "s1",
      "type": "string",
      "cDeclaration": "extern value_t s1;",
    }
  ];

  const expectedExecFuncNames = [
    "___bluescript_exec_func_0",
    "___bluescript_exec_func_1",
    "___bluescript_exec_func_2"
  ];

  expect(cString).toEqual(expectedCString);
  expect(newSymbols).toEqual(expectedNewSymbols);
  expect(execFuncNames).toEqual(expectedExecFuncNames);
});