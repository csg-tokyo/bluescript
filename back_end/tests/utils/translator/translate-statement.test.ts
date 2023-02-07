import getCString from "./test-cases/c-strings/get-c-string";
import getTSString from "./test-cases/ts-strings/get-ts-string";
import translate from "../../../src/utils/translator/translate";
import BlockEnv from "../../../src/utils/translator/env";

describe('Statements', () => {
  test("while-case1", () => {
    const tsString = getTSString("statements", "while-case1.ts");
    const env= new BlockEnv();
    const cString = translate(tsString, env);
    const expectedCString = getCString("statements", "while-case1.c");
    expect(cString).toBe(expectedCString);
  });

  test("break-case1", () => {
    const tsString = getTSString("statements", "break-case1.ts");
    const cString = translate(tsString, new BlockEnv());
    const expectedCString = getCString("statements", "break-case1.c");
    expect(cString).toBe(expectedCString);
  });

  test("if-case1", () => {
    const tsString = getTSString("statements", "if-case1.ts");
    const cString = translate(tsString, new BlockEnv());
    const expectedCString = getCString("statements", "if-case1.c");
    expect(cString).toBe(expectedCString);
  });

  test("if-case2", () => {
    const tsString = getTSString("statements", "if-case2.ts");
    const cString = translate(tsString, new BlockEnv());
    const expectedCString = getCString("statements", "if-case2.c");
    expect(cString).toBe(expectedCString);
  });

  test("if-case3", () => {
    const tsString = getTSString("statements", "if-case3.ts");
    const cString = translate(tsString, new BlockEnv());
    const expectedCString = getCString("statements", "if-case3.c");
    expect(cString).toBe(expectedCString);
  });
});
