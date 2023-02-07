import ReplCompilerChain from "../../src/compiler-toolchain/repl-compiler-chain";

describe('repl compiler chain', () => {
  test("define function and call it", async () => {
    let tsString = "function main(): integer { return 2 }";
    let compilerChain = new ReplCompilerChain();
    let result = await compilerChain.exec(tsString, true);
    expect(result.execFuncOffsets.length).toBe(0);
    expect(result.values.text).toBe("36610081e6ff980199080c821df0")
    expect(result.values.literal).toBe("1c27fc3f")
    // 2回目
    tsString = "main()";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(1);
    expect(result.values.text).toBe("364100e5feff1df0")
  });

  test("define variable and use it", async () => {
    let tsString = "let i:integer = 1;";
    let compilerChain = new ReplCompilerChain();
    let result = await compilerChain.exec(tsString, true);
    expect(result.execFuncOffsets.length).toBe(0);
    expect(result.values.bss).toBe("00474343")
    // 2回目
    tsString = "i = i + 1";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(1);
    expect(result.values.text).toBe("36410091e3ff88093ba8808aa38082211b88e0881189091df0");
    expect(result.values.literal).toBe("74b3fc3f");
  });

  test("use global variable in function", async () => {
    let tsString = "let i:integer = 1;";
    let compilerChain = new ReplCompilerChain();
    let result = await compilerChain.exec(tsString, true);
    expect(result.execFuncOffsets.length).toBe(0);
    expect(result.values.bss).toBe("00474343")
    // 2回目
    tsString = "function func1(): integer { let f:float = 3.4; return i + 2 }";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(0);
    expect(result.values.text).toBe("3641000c0821e3ff890221e2ff28023b822028a32022212b22e022111df0");
    expect(result.values.literal).toBe("1c27fc3f74b3fc3f");
    // 3回目
    tsString = "func1()";
    compilerChain = new ReplCompilerChain();
    result = await compilerChain.exec(tsString, false);
    expect(result.execFuncOffsets.length).toBe(1);
    expect(result.values.text).toBe("364100d5fdff1df0");
  })
});