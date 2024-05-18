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

  // Generate exe.
  let exe = generateExe(newLoadingUnit, entryPointName);

  return { exe, loadingUnitHead: newLoadingUnit };
}


function generateExe(loadingUnit: LoadingUnit, entryPointName: string) {
  const text = loadingUnit.textValue();
  const data = loadingUnit.dataValue();
  const entryPoint = loadingUnit.symbolAddress(entryPointName);

  let buffers: Buffer[] = [];

  // text size
  const textSizeBuf = Buffer.allocUnsafe(4);
  textSizeBuf.writeUIntLE(text.length, 0, 4);
  buffers.push(textSizeBuf);

  // data size
  const dataSizeBuf = Buffer.allocUnsafe(4);
  dataSizeBuf.writeUIntLE(data.length, 0, 4);
  buffers.push(dataSizeBuf);

  const entryPointBuf = Buffer.allocUnsafe(4);
  entryPointBuf.writeUIntLE(entryPoint, 0, 4);
  buffers.push(entryPointBuf);

  buffers.push(text);
  buffers.push(data);

  return Buffer.concat(buffers).toString("hex");
}

export {link, LoadingUnit};