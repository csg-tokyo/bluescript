import axios from "axios";
import { CompileError } from "../utils/error";


export type CompileResult = {
  text: string, 
  textAddress: number,
  data: string, 
  dataAddress: number,
  entryPoint: number
}

export async function replCompile(src: string): Promise<CompileResult> {
    return post("repl-compile", {src});
}

export async function clear() {
    return post("clear", {});
}

async function post(path: string, body: object) {
  const baseURL = "http://localhost:8080/";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  try {
    const response = await axios.post(
    baseURL + path,
    body,
    { headers }
  );
  return JSON.parse(response.data);
  } catch (e) {
    if (e instanceof axios.AxiosError) {
      if (e.response?.status === CompileError.errorCode) {
        throw new CompileError(JSON.parse(e.response?.data).message.messages)
      }
    }
    throw e;
  }
}
