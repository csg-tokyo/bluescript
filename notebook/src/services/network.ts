import axios from "axios";
import { CompileError, InternalError } from "../utils/error";
import { MemInfo } from "../utils/type";

export type MemoryUpdate = {
  blocks: {address: number, data: string, isFlash: boolean}[],
  entryPoints: number[]
}

export type CompileResult = {
    result: MemoryUpdate,
    compileTime: number
}

export async function compile(src: string, useFlash: boolean): Promise<CompileResult> {
  return post("compile", {src, useFlash});
}

export async function compileWithProfiling(src: string): Promise<CompileResult> {
  return post("compile-with-profiling", {src}); 
}

export async function jitCompile(funcId: number, paramTypes: string[]): Promise<CompileResult> {
  return post("jit-compile", {funcId, paramTypes});
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
      if (e.response?.status === InternalError.errorCode) {
        throw new InternalError(JSON.parse(e.response?.data).message.message)
      }
    }
    throw e;
  }
}
