import {Buffer} from "node:buffer";
import {AddressTableOrigin, AddressTable} from "./address-table";
import {LinkedELF32Parser, UnlinkedELF32Parser} from "./elf32-parser";
import * as fs from 'fs';
import FILE_PATH from "../constants";
import Linker from "./linker";

function link(buffer: Buffer, entryPointName: string, addressTable?: AddressTable) {
  // 1. read data from buffer
  let elfParser = new UnlinkedELF32Parser(buffer);

  // 2. decide address
  let _addressTable: AddressTable;
  if (addressTable === undefined) {
    const mcuBuffer = fs.readFileSync(FILE_PATH.MCU_ELF);
    const origin = new AddressTableOrigin(new LinkedELF32Parser(mcuBuffer));
    _addressTable = new AddressTable(elfParser, origin);
  } else
    _addressTable = new AddressTable(elfParser, addressTable);

  // 3. link
  let textSection = elfParser.textSection();
  let dataSection = elfParser.dataSection();

  let linker = new Linker(_addressTable);
  linker.link(textSection);
  linker.link(dataSection);

  // 4. set value size
  _addressTable.setTextSize(textSection.value.length);
  _addressTable.setDataSize(dataSection.value.length);

  // 5. get entry point
  let entryPoint = _addressTable.symbolAddress(entryPointName);

  // 6. generate exe
  let exe = generateExe(textSection.value, dataSection.value, entryPoint);

  return {exe, addressTable: _addressTable }
}


function generateExe(text: Buffer, data: Buffer, entryPoint: number) {
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

export {link, AddressTable};