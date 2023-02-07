import OnetimeCompilerChain from "../../src/compiler-toolchain/onetime-compiler-chain";

describe('onetime-compiler-chain', () => {
  test("case1", async () => {
    const tsString = "function main(): integer { return 2 }";
    const compilerChain = new OnetimeCompilerChain();
    const result = await compilerChain.execWithTsString(tsString);
    expect(result.values.text).toBe("36610081e6ff980199080c821df0");
    expect(result.values.literal).toBe("1c27fc3f")
  });

  test("case2", async () => {
    const tsString = "function main(n:integer): integer { console_log_number(n);\n return n+1; }";
    const compilerChain = new OnetimeCompilerChain();
    const result = await compilerChain.execWithTsString(tsString);
    expect(result.values.text).toBe("364100ad02a50c400c0981e4ff99083b822028a32022211b22e022111df0")
    expect(result.values.literal).toBe("1c27fc3f")
  });
});