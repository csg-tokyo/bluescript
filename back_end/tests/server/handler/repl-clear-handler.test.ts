import ReplClearHandler from "../../../src/server/path-handlers/repl-clear-handler";


test("happy flow", async () => {
  const clearHandler = new ReplClearHandler();
  const response = await clearHandler.handle();
  expect(response).toStrictEqual({message: "success"})
})