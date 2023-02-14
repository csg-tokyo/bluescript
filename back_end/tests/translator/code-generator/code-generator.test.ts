import {GlobalNameTable, Typechecker} from "../../../src/translator/type-checker/typechecker";
import * as visitor from "../../../src/translator/visitor";
import {CodeGenerator, GlobalRootSet} from "../../../src/translator/code-generator/code-generator";
import testCaseReader from "../test-case-reader";
import {runBabelParser} from "../../../src/translator/utils";

describe('expressions', () => {
  const calculationCases = testCaseReader("expressions.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts);

      const typechecker = new Typechecker();
      const nameTable = new GlobalNameTable();
      nameTable.record("i", "integer");
      nameTable.record("f", "float");
      nameTable.record("b", "boolean");
      visitor.file(ast, nameTable, typechecker);

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet();
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c)
    });
  }
});

describe('declarations', () => {
  const calculationCases = testCaseReader("declarations.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts);

      const typechecker = new Typechecker();
      const nameTable = new GlobalNameTable();
      visitor.file(ast, nameTable, typechecker);

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet();
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c)
    });
  }
});

describe('statements', () => {
  const calculationCases = testCaseReader("statements.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts);

      const typechecker = new Typechecker();
      const nameTable = new GlobalNameTable();
      nameTable.record("i", "integer");
      nameTable.record("f", "float");
      visitor.file(ast, nameTable, typechecker);

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet();
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c)
    });
  }
});

