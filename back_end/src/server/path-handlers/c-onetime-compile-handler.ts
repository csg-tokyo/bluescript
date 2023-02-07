import OnetimeCompilerChain from "../../compiler-toolchain/onetime-compiler-chain";

type ResponseType = {values:{[name: string]: string}, execFuncOffsets: number[]}

export default class COnetimeCompileHandler {
  cString:string;

  constructor(requestBody:any) {
    if (!("cString" in requestBody)) {
      throw Error("Request body should contain cString key.");
    }
    this.cString = requestBody.cString;
  }

  public async handle():Promise<ResponseType> {
    const compilerChain = new OnetimeCompilerChain();
    return compilerChain.execWithCString(this.cString);
  }
}