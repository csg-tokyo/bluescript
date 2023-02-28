import testCaseReader from "../test-case-reader";
import {runBabelParser} from "../../../src/transpiler/utils";
import {runTypeChecker} from "../../../src/transpiler/type-checker/type-checker";
import * as visitor from "../../../src/transpiler/visitor";
import {ReplCodeGenerator, ReplGlobalRootSet} from "../../../src/transpiler/code-generator/repl-code-generator";
import {GlobalNameTable} from "../../../src/transpiler/type-checker/names";

describe('repl-code-generator', () => {
  const calculationCases = testCaseReader("repl-code-generator.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts, 1);

      const globalNameTable = new GlobalNameTable();
      runTypeChecker(ast, globalNameTable);

      const codeGenerator = new ReplCodeGenerator();
      const rootSet = new ReplGlobalRootSet(globalNameTable);
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c)
    });
  }
});

// TODO: block内のvariable initのテスト。