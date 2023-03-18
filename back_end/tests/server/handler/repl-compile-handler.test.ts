import ReplCompileHandler from "../../../src/server/path-handlers/repl-compile-handler";
import TsOnetimeCompileHandler from "../../../src/server/path-handlers/ts-onetime-compile-handler";

describe("flow1", () => {
  test("case1", async () => {
    const tsString = "function func1():integer {return 2}"
    const compileHandler = new ReplCompileHandler({tsString, isFirst:true});
    const response = await compileHandler.handle();
    expect(response).toStrictEqual({
      values: {
        text: "3641000c221df0",
        literal: "",
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
        text: "36410065ffff1df0",
        literal: "",
        data: "",
        rodata: "",
        bss: "",
      },
      execFuncOffsets: [7]
    })
  })
})

test("playroom", async () => {
  const tsString = `console_log("foo");`;
  const replCompileHandler = new ReplCompileHandler({tsString, isFirst: true});
  const response = await replCompileHandler.handle();
  console.log(response)
});

