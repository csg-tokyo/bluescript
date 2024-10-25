import * as AST from "@babel/types";
import {FunctionEnv} from "../transpiler/code-generator/variables";
import {FunctionType, StaticType} from "../transpiler/types";


type FuncInfo = {
  id: number,
  name: string,
  src: string,
  type: FunctionType,
  specializedType?: FunctionType,
  profilingData?: number[]
}

export const typeCounterName = "bs_profiler_count_type"
export const callCountName =  "call_count";
export const callCountBorder = "5";

export const originalFuncPrefix = "original";


export class Profiler {
  private nextFuncId: number = 0;
  private funcs: Map<string, FuncInfo> = new Map();
  private id2Name: Map<number, string> = new Map();

  setFunc(name: string, src: string, type: FunctionType) {
    const id = this.nextFuncId++;
    this.funcs.set(name, {id, name, src, type});
    this.id2Name.set(id, name);
    return id;
  }

  getFunc(id: number) {
    const funcName = this.id2Name.get(id);
    return funcName ? this.funcs.get(funcName) : undefined;
  }

  setFuncSpecializedType(id: number, paramTypes: StaticType[]) {
    const funcName = this.id2Name.get(id);
    if (funcName === undefined)
      throw new Error(`Cannot not find the target function. id: ${id}`);
    const func = this.funcs.get(funcName);
    if (func === undefined)
      throw new Error(`Cannot not find the target function. name: ${funcName}`);
    func.specializedType = new FunctionType(func.type.returnType, paramTypes);
  }
}