import axios from "axios";

export type CCompileResult = {
  values: {
    text: string,
    literal: string,
    data: string,
    rodata: string,
    bss: string
  }
  execFuncOffsets: number[]
}

export default async function COnetimeCompile(cString:string):Promise<CCompileResult> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': "*"
  }
  const response =  await axios.post("http://localhost:8080/c-onetime-compile", {cString}, {headers});
  console.log(JSON.parse(response.data));
  return JSON.parse(response.data);
}