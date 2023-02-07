import TsOnetimeCompileHandler from "../../../src/server/path-handlers/ts-onetime-compile-handler";
import ReplClearHandler from "../../../src/server/path-handlers/repl-clear-handler";

describe("cases", () => {
  beforeAll(async () => {
    const clearHandler = new ReplClearHandler();
    await clearHandler.handle();
  });

  test("case1", async () => {
    const tsString = "function main():number {return 2;}";
    const tsOnceCompileHandler = new TsOnetimeCompileHandler({tsString});
    const response = await tsOnceCompileHandler.handle();
    expect(response).toStrictEqual({
      values: {
        text: "36610081e6ff980199080c821df0",
        literal: "1c27fc3f",
        data: "",
        rodata: "",
        bss: "",
      },
      execFuncOffsets: [0]
    })
  });
})

