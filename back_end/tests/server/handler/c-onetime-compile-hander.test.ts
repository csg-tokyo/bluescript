import COnetimeCompileHandler from "../../../src/server/path-handlers/c-onetime-compile-handler";
import ReplClearHandler from "../../../src/server/path-handlers/repl-clear-handler";

describe("cases", () => {
  beforeAll(async () => {
    const clearHandler = new ReplClearHandler();
    await clearHandler.handle();
  });

  test("case1", async () => {
    const cString = "int main() {return 2;}";
    const cOnceCompileHandler = new COnetimeCompileHandler({cString});
    const response = await cOnceCompileHandler.handle();
    expect(response).toStrictEqual({
      values: {
        text: "3641000c221df0",
        literal: "",
        data: "",
        rodata: "",
        bss: "",
      },
      execFuncOffsets: [0]
    })
  });
})

