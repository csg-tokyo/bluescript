import ReplCompilerChain from "../../compiler-toolchain/repl-compiler-chain";

type ResponseType = {values:{[name: string]: string}, execFuncOffsets: number[]}

export default class ReplCompileHandler {
  tsString: string;
  isFirst: boolean;

  constructor(requestBody: any) {
    if (!("tsString" in requestBody)) {
      throw Error("Request body should contain tsString key.");
    }
    this.tsString = requestBody.tsString;
    this.isFirst = Boolean(requestBody.isFirst)
  }

  public async handle(): Promise<ResponseType> {
    const compilerChain = new ReplCompilerChain();
    return compilerChain.exec(this.tsString, this.isFirst);
  }
}