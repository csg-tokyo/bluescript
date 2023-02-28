import {SymbolModel} from "../../src/models/symbol-model";
import {replTranspile} from "../../src/transpiler/repl-transpile";

test("repl-transpile", () => {
  const existingSymbol:SymbolModel[] = [
    {
      "name": "i",
      "access": "public",
      "declaration": "int32_t i;",
      "type": {
        "symbolType": "variable",
        "variableType": "integer"
      }
    },
    {
      "name": "s",
      "access": "public",
      "declaration": "value_t s;",
      "type": {
        "symbolType": "variable",
        "variableType": "string"
      }
    },
  ]
  const tsString = `let f:float = 3.4;
  f * i;
  let s1:string = "Hello world!";`;
  const {cString, newSymbols, execFuncNames} = replTranspile(tsString, existingSymbol);

  const expectedCString = `float f;
void ___bluescript_exec_func_0 {
f = 3.4;
};
void ___bluescript_exec_func_1 {
f * i;
};
value_t s1;
void ___bluescript_exec_func_2 {
s1 = gc_new_string("Hello world!");
gc_array_set(global_root_set_array, int_to_value(1), s1);
};

`;
  const expectedNewSymbols:SymbolModel[] = [
    {
      "name": "f",
      "access": "public",
      "declaration": "float f;",
      "type": {
        "symbolType": "variable",
        "variableType": "float"
      }
    },
    {
      "name": "s1",
      "access": "public",
      "declaration": "value_t s1;",
      "type": {
        "symbolType": "variable",
        "variableType": "string"
      }
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