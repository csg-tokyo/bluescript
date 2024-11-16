import {Any, ArrayType, FunctionType, StaticType} from "../transpiler/types";
import {ProfileError} from "./utils";


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

export const callCounterName =  "call_count";
export const typeProfilerName = "type_profile";
export const profileFunctionName = "bs_profiler_profile";
export const maxParamNum = 4;

export class Profiler {
  private nextFuncId: number = 0;
  private profiles: Map<string, FunctionProfile> = new Map();
  private idToName: Map<number, string> = new Map();

  setFunctionProfile(name: string, src: string, type: FunctionType) {
    const id = this.nextFuncId++;
    const profile:FunctionProfile = {id, name, src, type, state: {state: "profiling"}}
    this.profiles.set(name, profile);
    this.idToName.set(id, name);
    return profile;
  }

  getFunctionProfileById(id: number) {
    const funcName = this.idToName.get(id);
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
    const funcName = this.idToName.get(id);
    if (funcName === undefined)
      throw new ProfileError(`Cannot find the target function. id: ${id}`);
    const func = this.profiles.get(funcName);
    if (func === undefined)
      throw new ProfileError(`Cannot not find the target function. name: ${funcName}`);
    if (!Profiler.funcIsSpecializable(func, paramTypes)) {
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

  static funcNeedsProfiling(funcType: FunctionType) {
    const returnType = funcType.returnType;
    if (!funcType.paramTypes.includes(Any) || funcType.paramTypes.filter(t=> t === Any).length > maxParamNum)
      return false;
    if (returnType instanceof FunctionType)
      return false;
    const acceptableElementTypes: StaticType[] = ['integer', 'float', 'boolean', 'any']
    if (returnType instanceof ArrayType && !acceptableElementTypes.includes(returnType.elementType))
      return false;
    return true;
  }

  static funcIsSpecializable(func: FunctionProfile, paramTypes: StaticType[]) {
    return !paramTypes.slice(0, func.type.paramTypes.length).every(t => t === Any);
  }
}