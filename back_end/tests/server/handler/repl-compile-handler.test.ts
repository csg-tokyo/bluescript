import ReplCompileHandler from "../../../src/server/path-handlers/repl-compile-handler";

describe("flow1", () => {
  test("case1", async () => {
    const tsString = "function func1():integer {return 2}"
    const compileHandler = new ReplCompileHandler({tsString, isFirst:true});
    const response = await compileHandler.handle();
    expect(response).toStrictEqual({
      values: {
        text: "36610081e6ff980199080c821df0",
        literal: "1c27fc3f",
        data: "",
        rodata: "",
        bss: "",
      },
      execFuncOffsets: []
    })
  });

  test("case2", async () => {
    const tsString = "func1()"
    const compileHandler = new ReplCompileHandler({tsString, isFirst: false});
    const response = await compileHandler.handle();
    expect(response).toStrictEqual({
      values: {
        text: "364100e5feff1df0",
        literal: "",
        data: "",
        rodata: "",
        bss: "",
      },
      execFuncOffsets: [14]
    })
  })
})

