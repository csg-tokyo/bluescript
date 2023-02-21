import * as visitor from "../../../src/transpiler/visitor";
import {CodeGenerator, GlobalRootSet} from "../../../src/transpiler/code-generator/code-generator";
import testCaseReader from "../test-case-reader";
import {runBabelParser} from "../../../src/transpiler/utils";
import {runTypeChecker} from "../../../src/transpiler/type-checker/type-checker";
import {FunctionType} from "../../../src/transpiler/types";
import {GlobalNameTable} from "../../../src/transpiler/type-checker/names";

describe('expressions', () => {
  const calculationCases = testCaseReader("expressions.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts,1);

      const globalNameTable = new GlobalNameTable();
      globalNameTable.record("i", "integer");
      globalNameTable.record("f", "float");
      globalNameTable.record("b", "boolean");
      globalNameTable.record("greeting", new FunctionType("void", []));
      globalNameTable.record("console_log_number", new FunctionType("void", ["integer"]));
      globalNameTable.record("add", new FunctionType("void", ["integer", "integer"]));
      runTypeChecker(ast, globalNameTable)

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
      const ast = runBabelParser(cs.ts, 1);

      const globalNameTable = new GlobalNameTable();
      runTypeChecker(ast, globalNameTable);

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet();
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c);
    });
  }
});

describe('statements', () => {
  const calculationCases = testCaseReader("statements.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts, 1);

      const globalNameTable = new GlobalNameTable();
      globalNameTable.record("i", "integer");
      globalNameTable.record("f", "float");
      runTypeChecker(ast, globalNameTable);

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet();
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c);
    });
  }
});

