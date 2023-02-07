import axios from "axios";

export type ClearResult = {
  message: string,
}

export default async function replClear():Promise<ClearResult> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': "*"
  }
  const response =  await axios.post("http://localhost:8080/repl-clear", {}, {headers});
  return JSON.parse(response.data);
}