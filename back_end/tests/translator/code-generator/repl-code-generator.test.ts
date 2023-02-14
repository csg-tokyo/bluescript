import testCaseReader from "../test-case-reader";
import {runBabelParser} from "../../../src/translator/utils";
import {GlobalNameTable, Typechecker} from "../../../src/translator/type-checker/typechecker";
import * as visitor from "../../../src/translator/visitor";
import {ReplCodeGenerator, ReplGlobalRootSet} from "../../../src/translator/code-generator/repl-code-generator";

describe('repl-code-generator', () => {
  const calculationCases = testCaseReader("repl-code-generator.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts);

      const typechecker = new Typechecker();
      const nameTable = new GlobalNameTable();
      visitor.file(ast, nameTable, typechecker);

      const codeGenerator = new ReplCodeGenerator();
      const rootSet = new ReplGlobalRootSet();
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c)
    });
  }
});