import * as visitor from "../../../src/transpiler/visitor";
import {CodeGenerator} from "../../../src/transpiler/code-generator/code-generator";
import testCaseReader from "../test-case-reader";
import {runBabelParser} from "../../../src/transpiler/utils";
import {runTypeChecker} from "../../../src/transpiler/type-checker/type-checker";
import {FunctionType} from "../../../src/transpiler/types";
import {GlobalNameTable, NameInfo} from "../../../src/transpiler/type-checker/names";
import {GlobalRootSet} from "../../../src/transpiler/code-generator/root-set";

describe('expressions', () => {
  const calculationCases = testCaseReader("expressions.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts,1);

      const globalNameTable = new GlobalNameTable();
      globalNameTable.record("i", new NameInfo("integer"));
      globalNameTable.record("f", new NameInfo("float"));
      globalNameTable.record("b", new NameInfo("boolean"));
      globalNameTable.record("greeting", new NameInfo(new FunctionType("void", [])));
      globalNameTable.record("console_log_number", new NameInfo(new FunctionType("void", ["integer"])));
      globalNameTable.record("add", new NameInfo(new FunctionType("void", ["integer", "integer"])));
      runTypeChecker(ast, globalNameTable)

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet(globalNameTable);
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
      globalNameTable.record("ii", new NameInfo("integer"));
      globalNameTable.record("ss", new NameInfo("string"));
      runTypeChecker(ast, globalNameTable);

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet(globalNameTable);
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c);
    });
  }
});
// TODO: 関数がstringをそのまま返す場合の対処は？ 例：return "Hello!"

describe('statements', () => {
  const calculationCases = testCaseReader("statements.txt");
  for (const cs of calculationCases) {
    test(cs.name, () => {
      const ast = runBabelParser(cs.ts, 1);

      const globalNameTable = new GlobalNameTable();
      globalNameTable.record("i", new NameInfo("integer"));
      globalNameTable.record("f", new NameInfo("float"));
      runTypeChecker(ast, globalNameTable);

      const codeGenerator = new CodeGenerator();
      const rootSet = new GlobalRootSet(globalNameTable);
      visitor.file(ast, rootSet, codeGenerator);

      expect(codeGenerator.result).toBe(cs.c);
    });
  }
});

