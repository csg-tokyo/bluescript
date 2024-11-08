import {Any, ArrayType, BooleanT, Float, FunctionType, Integer, ObjectType, StaticType} from "../transpiler/types";


export type FunctionState =
  {state: 'profiling'} |
  {state: 'specializing', type: FunctionType} |
  {state: 'undoing'} |
  {state: 'specialized', type: FunctionType} |
  {state: 'unspecialized'}

export type FunctionProfile = {
  id: number,
  name: string,
  src: string,
  type: FunctionType,
  state: FunctionState,
}

export const typeCounterName = "type_count";
export const typeCountFunctionName = "bs_profiler_typecount";
export const callCounterName =  "call_count";
export const callCountThreshold = 5;
export const maxParamNum = 4;

export class Profiler {
  private nextFuncId: number = 0;
  private profiles: Map<string, FunctionProfile> = new Map();
  private id2Name: Map<number, string> = new Map();

  setFunctionProfile(name: string, src: string, type: FunctionType) {
    const id = this.nextFuncId++;
    const profile:FunctionProfile = {id, name, src, type, state: {state: "profiling"}}
    this.profiles.set(name, profile);
    this.id2Name.set(id, name);
    return profile;
  }

  getFunctionProfileById(id: number) {
    const funcName = this.id2Name.get(id);
    return funcName ? this.profiles.get(funcName) : undefined;
  }

  getFunctionProfileByName(name: string) {
    return this.profiles.get(name);
  }

  setFunctionState(name: string, state: FunctionState) {
    const func = this.profiles.get(name);
    if (func !== undefined)
      func.state = state;
  }

  setFuncSpecializedType(id: number, paramTypes: StaticType[]) {
    const funcName = this.id2Name.get(id);
    if (funcName === undefined)
      throw new Error(`Cannot not find the target function. id: ${id}`);
    const func = this.profiles.get(funcName);
    if (func === undefined)
      throw new Error(`Cannot not find the target function. name: ${funcName}`);
    if (paramTypes.slice(0, func.type.paramTypes.length).every(t => t === Any)) {
      func.state = {state: 'undoing'}
      return;
    }

    const specializedParamTypes: StaticType[] = [];
    let s = 0;
    for (const ofpt of func.type.paramTypes) {
      if (ofpt !== Any)
        specializedParamTypes.push(ofpt)
      else
        specializedParamTypes.push(paramTypes[s++]);
    }
    func.state = {state: 'specializing', type: new FunctionType(func.type.returnType, specializedParamTypes)};
  }

  // TODO: 一つに定まらない時はundefinedを返す
  static profiledData2Type(profiled: number[]):StaticType[] {
    const counts:{[t: number]: number} = {}
    profiled.forEach(t => {
      counts[t] = counts[t] ? counts[t]+1 : 1;
    });
    const maxT = Object.entries(counts).reduce((pre, cur) => cur[1] > pre[1] ? cur : pre, ["-1", -1]);
    const maxTNum = Number(maxT[0]);
    if (isNaN(maxTNum))
      throw new Error(`fatal: Unexpected type value: ${maxT[0]}`);
    return  [Profiler.int2Type(maxTNum & 0xf), Profiler.int2Type((maxTNum & 0xf0) >> 4),
      Profiler.int2Type((maxTNum & 0xf00) >> 8), Profiler.int2Type((maxTNum & 0xf000) >> 12)]
  }

  private static int2Type(int: number): StaticType {
    switch (int) {
      case 0:
        return Integer
      case 1:
        return Float
      case 2:
        return BooleanT
      case 3:
        return new ArrayType(Integer)
      case 4:
        return new ArrayType(Float)
      case 5:
        return new ArrayType(BooleanT)
      default:
        return Any
    }
  }
}