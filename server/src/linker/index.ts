import {Buffer} from "node:buffer";
import {LoadingUnit, LoadingUnitOrigin} from "./loading-unit";
import {LinkedELF32Parser, UnlinkedELF32Parser} from "./elf32-parser";
import * as fs from 'fs';
import FILE_PATH from "../constants";

function link(buffer: Buffer, entryPointName: string, loadingUnitHead?: LoadingUnit) {
  // Read data from ELF buffer.
  let elfParser = new UnlinkedELF32Parser(buffer);

  // Create new loading unit.
  let newLoadingUnit: LoadingUnit;
  if (loadingUnitHead === undefined) {
    const mcuBuffer = fs.readFileSync(FILE_PATH.MCU_ELF);
    const origin = new LoadingUnitOrigin(new LinkedELF32Parser(mcuBuffer));
    newLoadingUnit = new LoadingUnit(elfParser, origin);
  } else
    newLoadingUnit = new LoadingUnit(elfParser, loadingUnitHead);

  return {
    exe: {
      text: newLoadingUnit.textValue().toString("hex"),
      textAddress: newLoadingUnit.textAddress,
      data: newLoadingUnit.dataValue().toString("hex"),
      dataAddress: newLoadingUnit.dataAddress,
      entryPoint: newLoadingUnit.symbolAddress(entryPointName)
    },
    loadingUnitHead: newLoadingUnit
  }
}

export {link, LoadingUnit};