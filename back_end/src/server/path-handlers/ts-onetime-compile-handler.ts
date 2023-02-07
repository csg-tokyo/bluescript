import OnetimeCompilerChain from "../../compiler-toolchain/onetime-compiler-chain";

type ResponseType = {values:{[name: string]: string}, execFuncOffsets: number[]}


export default class TsOnetimeCompileHandler {
  tsString:string;

  constructor(requestBody:any) {
    if (!("tsString" in requestBody)) {
      throw Error("Request body should contain cString key.");
    }
    this.tsString = requestBody.tsString;
  }

  public async handle():Promise<ResponseType> {
    const compilerChain = new OnetimeCompilerChain();
    return compilerChain.execWithTsString(this.tsString);
  }
}