import ReplCompilerChain from "../../src/compiler-toolchain/repl-compiler-chain";

describe('repl compiler chain', () => {
  test("define function and call it", async () => {
    let tsString = "function main(): integer { return 2 }";
    let compilerChain = new ReplCompilerChain();
    let result = await compilerChain.exec(tsString, true);
    expect(result.execFuncOffsets.length).toBe(0);
    expect(result.values.text).toBe("3641000c221df0")
    // 2回目
    tsString = "main()";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(1);
    expect(result.values.text).toBe("364100e5ffff1df0")
  });

  test("define variable and use it", async () => {
    let tsString = "let i:integer = 1;";
    let compilerChain = new ReplCompilerChain();
    let result = await compilerChain.exec(tsString, true);
    expect(result.execFuncOffsets.length).toBe(1);
    // 2回目
    tsString = "i = i + 1";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(1);
    expect(result.values.text).toBe("36410091e6ff88091b8889091df0");
    expect(result.values.literal).toBe("78b3fc3f");
  });

  test("use global variable in function", async () => {
    let tsString = "let i:integer = 1;";
    let compilerChain = new ReplCompilerChain();
    let result = await compilerChain.exec(tsString, true);
    expect(result.execFuncOffsets.length).toBe(1);
    // 2回目
    tsString = "function func1(): integer { let f:float = 3.4; return i + 2 }";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(0);
    expect(result.values.text).toBe("36410021e6ff28022b221df0");
    expect(result.values.literal).toBe("78b3fc3f");
    // 3回目
    tsString = "func1()";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(1);
    expect(result.values.text).toBe("364100e5ffff1df0");
  })
});