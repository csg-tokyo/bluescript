import {ShadowMemory} from "./shadow-memory";
import FILE_PATH from "../constants";

export function link(objFilePath: string, entryPointName: string, shadowMemory?: ShadowMemory) {
  let sm = shadowMemory;
  if (sm === undefined)
    sm = new ShadowMemory(FILE_PATH.MCU_ELF);

  sm.loadAndLink(objFilePath);
  const update = sm.getLatestUpdate();
  const entryPoint = sm.getSymbolAddress(entryPointName);
  if (entryPoint === undefined) {
    throw new Error("Cannot find entry point");
  }

  return {
    exe: {...update, entryPoint},
    shadowMemory: sm
  }
}