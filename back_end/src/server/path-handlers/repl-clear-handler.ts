import ReplCompilerChain from "../../compiler-toolchain/repl-compiler-chain";


export default class ReplClearHandler {
  public async handle(): Promise<object> {
    const compilerChain = new ReplCompilerChain();
    await compilerChain.clearEnv();
    return {message: "success"};
  }
}