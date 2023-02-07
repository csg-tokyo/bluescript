import getCString from "./test-cases/c-strings/get-c-string";
import getTSString from "./test-cases/ts-strings/get-ts-string";
import translate from "../../../src/utils/translator/translate";
import BlockEnv from "../../../src/utils/translator/env";

describe('Function', () => {
  test("case1", () => {
    const tsString = getTSString("functions", "case1.ts");
    const env= new BlockEnv();
    env.addVariable("b", "float");
    const cString = translate(tsString, env);
    const expectedCString = getCString("functions", "case1.c");
    expect(cString).toBe(expectedCString);
  });

  test("case2", () => {
    const tsString = getTSString("functions", "case2.ts");
    const cString = translate(tsString, new BlockEnv());
    const expectedCString = getCString("functions", "case2.c");
    expect(cString).toBe(expectedCString);
  });

  test("case3", () => {
    const tsString = getTSString("functions", "case3.ts");
    const cString = translate(tsString, new BlockEnv());
    const expectedCString = getCString("functions", "case3.c");
    expect(cString).toBe(expectedCString);
  });
});
