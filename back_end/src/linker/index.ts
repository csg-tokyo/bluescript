import AddressTable from "./addresses";
import SectionValueFactory from "./section-value-factory";
import {Buffer} from "node:buffer";
import CONSTANTS from "../constants";


export function link(sessionId: number, elfBuffer: Buffer, newSymbolNames: string[], addressTable: AddressTable) {
  // Prepare data.
  const sectionAddresses = addressTable.sectionTable.sections()
  const symbolAddresses = addressTable.symbolTable.symbols()

  // Link.
  const factory = new SectionValueFactory(elfBuffer, symbolAddresses, sectionAddresses)
  const strategy = factory.generateStrategy()
  const sectionValues:{[name: string]: Buffer} = {}
  const useMemorySizes: {[name: string]: number} = {}
  CONSTANTS.VIRTUAL_SECTION_NAMES.forEach(sectionName => {
    const value = factory.generateSectionValue(sectionName.realName)
    sectionValues[sectionName.realName] = value.getLinkedValue(strategy)
    useMemorySizes[sectionName.realName] = value.getSize()
  });
  const sessionMain = CONSTANTS.ENTRY_POINT_NAME + sessionId
  const entryPoint = factory.getSymbolAddresses([sessionMain])[sessionMain]
  const newSymbolAddresses = factory.getSymbolAddresses(newSymbolNames.map(name => "_" + name))

  // record new data
  addressTable.symbolTable.record(newSymbolAddresses)
  addressTable.sectionTable.recordUsedMemory(useMemorySizes)

  // return value
  const exeBuffer = generateExeBuffer(sectionValues, entryPoint)
  return {exe: exeBuffer.toString("hex"), addressTable}
}

function generateExeBuffer(sectionValues: {[name: string]: Buffer}, entryPoint: number):Buffer {
  const lengths = Buffer.from(CONSTANTS.VIRTUAL_SECTION_NAMES.map(name => sectionValues[name.realName].length))
  const epBuffer = Buffer.from(entryPoint.toString(16), "hex")
  const values = Buffer.concat(CONSTANTS.VIRTUAL_SECTION_NAMES.map(name => sectionValues[name.realName]))
  return Buffer.concat([lengths, epBuffer, values])
}