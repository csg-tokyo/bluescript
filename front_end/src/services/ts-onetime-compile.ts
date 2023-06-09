import axios from "axios";

export type TSCompileResult = {
  exe: string
}

export default async function tsOnetimeCompile(tsString:string):Promise<TSCompileResult> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': "*"
  }
  const response =  await axios.post("http://localhost:8080/ts-onetime-compile", {tsString}, {headers});
  console.log(JSON.parse(response.data))
  return JSON.parse(response.data);
}