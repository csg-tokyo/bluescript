import {Buffer} from "node:buffer";
import * as fs from 'fs';
import {AddressTable, AddressTableAncestor, AddressTableInterface} from "./address-table";
import {ExePart} from "./utils";
import CONSTANTS from "../constants";
import Elf32 from "./elf-parser/elf32";
import Linker from "./linker";


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
  const entryPoint = addressTable.getSymbolAddress(entryPointName);

  const exePart = new ExePart(textValue, literalValue, Buffer.concat(dataValues), entryPoint);
  return {exe: exePart.toString(), addressTable};
}

export function addressTableAncestor(nativeSymbolNames: string[]): AddressTableAncestor {
  const mcuBuffer = fs.readFileSync(CONSTANTS.MCU_ELF_PATH);
  return new AddressTableAncestor(new Elf32(mcuBuffer), nativeSymbolNames);
}