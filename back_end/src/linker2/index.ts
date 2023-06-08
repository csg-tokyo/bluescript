import AddressTable from "./addresses";
import SectionValueFactory from "../linker/section-value-factory";
import {SectionNameArr} from "../linker/models";
import {Buffer} from "node:buffer";


export function link(sessionId: number, elfBuffer: Buffer, newSymbolNames: string[], addressTable: AddressTable) {
  // Prepare data.
  const sectionAddresses = addressTable.sectionTable.sections()
  const symbolAddresses = addressTable.symbolTable.symbols()

  // Link.
  const factory = new SectionValueFactory(elfBuffer, symbolAddresses, sectionAddresses)
  const strategy = factory.generateStrategy()
  const sectionValues:{[name: string]: Buffer} = {}
  const useMemorySizes: {[name: string]: number} = {}
  SectionNameArr.forEach(sectionName => {
    const value = factory.generateSectionValue(sectionName)
    sectionValues[sectionName] = value.getLinkedValue(strategy)
    useMemorySizes[sectionName] = value.getSize()
  });
  const entryPoint = factory.getSymbolAddresses(["bluescript_main" + sessionId])[0]
  const newSymbolAddresses = factory.getSymbolAddresses(newSymbolNames)

  // record new data
  addressTable.symbolTable.record(newSymbolAddresses)
  addressTable.sectionTable.recordUsedMemory(useMemorySizes)

  // return value
  const exeBuffer = generateExeBuffer(sectionValues, entryPoint)
  return {exe: exeBuffer.toString("hex"), addressTable}
}

function generateExeBuffer(sectionValues: {[name: string]: Buffer}, entryPoint: number):Buffer {
  const lengths = Buffer.from(SectionNameArr.map(name => sectionValues[name].length))
  const epBuffer = Buffer.from([entryPoint])
  const values = Buffer.concat(SectionNameArr.map(name => sectionValues[name]))
  return Buffer.concat([lengths, epBuffer, values])
}