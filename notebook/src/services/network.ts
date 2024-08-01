import axios from "axios";
import { CompileError } from "../utils/error";


export type CompileResult = {
    iram: {address: number, data: string},
    dram: {address: number, data: string},
    flash: {address: number, data: string},
    entryPoint: number
}

export type MemInfo = {
  iram:{address:number, size:number},
  dram:{address:number, size:number},
  flash:{address:number, size:number}
}

export async function compile(src: string, useFlash: boolean): Promise<CompileResult> {
  return post("compile", {src, useFlash});
}

export async function reset(memInfo:MemInfo) {
    return post("reset", memInfo);
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
