import AddressTable from "./addresses";
import SectionValueFactory from "../linker2/section-value-factory";
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
  const sessionMain = "bluescript_main" + sessionId
  const entryPoint = factory.getSymbolAddresses([sessionMain])[sessionMain]
  const newSymbolAddresses = factory.getSymbolAddresses(newSymbolNames)

  // record new data
  addressTable.symbolTable.record(newSymbolAddresses)
  addressTable.sectionTable.recordUsedMemory(useMemorySizes)

  // return value
  const exeBuffer = generateExeBuffer(sectionValues, entryPoint)
  console.log(exeBuffer.toString("hex"))
  return {exe: exeBuffer.toString("hex"), addressTable}
}

function generateExeBuffer(sectionValues: {[name: string]: Buffer}, entryPoint: number):Buffer {
  Object.keys(sectionValues).forEach(sectionName => {
    console.log(sectionName, sectionValues[sectionName].toString("hex"), sectionValues[sectionName].length.toString(16))
  })
  console.log(entryPoint.toString(16))
  const lengths = Buffer.from(CONSTANTS.VIRTUAL_SECTION_NAMES.map(name => sectionValues[name.realName].length))
  const epBuffer = Buffer.from(entryPoint.toString(16), "hex")
  console.log(epBuffer)
  const values = Buffer.concat(CONSTANTS.VIRTUAL_SECTION_NAMES.map(name => sectionValues[name.realName]))
  return Buffer.concat([lengths, epBuffer, values])
}