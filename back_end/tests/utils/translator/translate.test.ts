import ExpressionStatementCases from "./test-cases/expressiont-statements";
import BlockEnv from "../../../src/utils/translator/env";
import DeclarationCases from "./test-cases/declaration";
import translate from "../../../src/utils/translator/translate";
import * as babelParser from "@babel/parser";
import DeclarationFailCases from "./test-cases/declaration-fail";

describe("ExpressionStatement", ()=>{
  ExpressionStatementCases.forEach(testCase=>{
    test(testCase.input + " -> " + testCase.output, ()=>{
      const env = new BlockEnv();
      env.addVariable("i", "integer");
      env.addVariable("f", "float");
      env.addFunction("func1", [{name: "i", type: "integer"}, {name: "f", type: "float"}], "void");
      env.addFunction("func2", [], "integer");
      const cString:string = translate(testCase.input, env)
      expect(cString).toBe(testCase.output);
    })
  })
})

describe("Declaration", ()=>{
  DeclarationCases.forEach(testCase=>{
    test(testCase.input + " -> " + testCase.output, ()=>{
      const env = new BlockEnv();
      const cString:string = translate(testCase.input, env)
      expect(cString).toBe(testCase.output);
    })
  })
})

describe("DeclarationFail", ()=>{
  DeclarationFailCases.forEach(testCase=>{
    test(testCase.input, ()=>{
      const env = new BlockEnv();
      env.addFunction("func1", [{name: "i", type: "integer"}, {name: "f", type: "float"}], "void")
      expect(() => translate(testCase.input, env)).toThrow(Error);
    })
  })
})

test("Dummy", () => {
  const jsString = "i = func1();"
  const node = babelParser.parse(jsString, {plugins: ["typescript"]});
  console.log(JSON.stringify(node))
})