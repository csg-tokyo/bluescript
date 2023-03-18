import TsOnetimeCompileHandler from "../../../src/server/path-handlers/ts-onetime-compile-handler";

describe("cases", () => {
  test("case1", async () => {
    const tsString = "function main():number {return 2;}";
    const tsOnceCompileHandler = new TsOnetimeCompileHandler({tsString});
    const response = await tsOnceCompileHandler.handle();
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

  test("playroom", async () => {
    const tsString = `
    function func1():void {
      let s:string = "Hello";
      console_log(s);
    }
    `;
    const tsOnceCompileHandler = new TsOnetimeCompileHandler({tsString});
    const response = await tsOnceCompileHandler.handle();
    console.log(response)
  });
})

