import {Buffer} from "node:buffer";
import * as fs from 'fs';
import {AddressTable, AddressTableOrigin, AddressTableInterface} from "./address-table";
import {ExePart} from "./utils";
import FILE_PATH from "../constants";
import Elf32 from "./elf-parser/elf32";
import Linker from "./linker";


const runtimeSection = ".flash.text";
const hardwarelibSection = ".hardwarelib";


export default function link(elfBuffer: Buffer, entryPointName: string, at: AddressTableInterface) {
  const elf32 = new Elf32(elfBuffer);
  const addressTable = new AddressTable(elf32, at);
  const linker = new Linker(elf32, addressTable);

  const textValue = linker.linkedValue(addressTable.textSection.name);
  const literalValue = linker.linkedValue(addressTable.literalSection.name);
  const dataValues: Buffer[] = [];
  addressTable.dataSection.subSections.forEach((subSection) => {
    dataValues.push(linker.linkedValue(subSection.name));
  });
  dataValues.push(Buffer.alloc(addressTable.dataSection.commonSize));
  const entryPoint = addressTable.getSymbolAddress(entryPointName);

  const exePart = new ExePart(textValue, literalValue, Buffer.concat(dataValues), entryPoint);
  return {exe: exePart.toString(), addressTable};
}

export function addressTableOrigin(): AddressTableOrigin {
  const mcuBuffer = fs.readFileSync(FILE_PATH.MCU_ELF);
  return new AddressTableOrigin(new Elf32(mcuBuffer), [runtimeSection, hardwarelibSection]);
}