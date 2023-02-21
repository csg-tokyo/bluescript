import testCaseReader from "../test-case-reader";
import {runBabelParser} from "../../../src/translator/utils";
import {runTypeChecker} from "../../../src/translator/type-checker/typechecker";
import * as visitor from "../../../src/translator/visitor";
import {ReplCodeGenerator, ReplGlobalRootSet} from "../../../src/translator/code-generator/repl-code-generator";
import {GlobalNameTable} from "../../../src/translator/type-checker/names";

describe('repl-code-generator', () => {
  const calculationCases = testCaseReader("repl-code-generator.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts, 1);

      const globalNameTable = new GlobalNameTable();
      runTypeChecker(ast, globalNameTable);

      const codeGenerator = new ReplCodeGenerator();
      const rootSet = new ReplGlobalRootSet();
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c)
    });
  }
});