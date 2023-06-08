import OnetimeCompilerChain from "../../src/compiler-toolchain/onetime-compiler-chain";

describe('onetime-compiler-chain', () => {
  test("case1", async () => {
    const tsString = "function func1(): integer { return 2 }";
    const compilerChain = new OnetimeCompilerChain();
    const result = await compilerChain.execWithTsString(tsString);
    expect(result).toBe("")
    expect(result.values.text).toBe("3641000c221df0");
  });

  test("case2", async () => {
    const tsString = "function main(n:integer): integer { console_log_number(n);\n return n+1; }";
    const compilerChain = new OnetimeCompilerChain();
    const result = await compilerChain.execWithTsString(tsString);
    expect(result.values.text).toBe("364100ad02a50c401b221df0")
  });
});