import {LinkerScript} from "../linker/linker-script";
import * as fs from "fs";
import {ExecutableElfReader} from "../linker/elf-reader";
import {FILE_PATH} from "../constants";
import {MemoryRegion} from "../linker/shadow-memory";
import Session from "../server/session";

const componentsPath = '/Users/maejimafumika/Desktop/Lab/research/bluescript/microcontroller/ports/esp32/build/esp-idf/'
const dependenciesJsonPath = '../microcontroller/ports/esp32/build/project_description.json'

function getComponents(targetComponent: string) {
  const dependenciesJson = JSON.parse(fs.readFileSync(dependenciesJsonPath).toString())
  const componentInfo = dependenciesJson.build_component_info
  let tmp = [targetComponent]
  let visited = new Set<string>()
  const componentPaths:string[] = []
  while(tmp.length > 0) {
    let curr = tmp.shift() as string
    visited.add(curr)
    tmp = tmp.concat(
      componentInfo[curr].priv_reqs.filter((r:string) => !visited.has(r)),
      componentInfo[curr].reqs.filter((r:string) => !visited.has(r))
    )
    if (componentInfo[curr].file !== undefined && componentInfo[curr].file !== '')
      componentPaths.push(componentInfo[curr].file)
  }
  return componentPaths

}


function main(moduleName: string) {
  let components = getComponents(moduleName)
  const bsRuntime = new ExecutableElfReader(FILE_PATH.MCU_ELF);

  const linkerScript = new LinkerScript(
    new MemoryRegion('IRAM', 0x410000, 50000),
    new MemoryRegion('DRAM', 0x310000, 50000),
    new MemoryRegion('Flash', 0x210000, 100000),
    true
  )
  linkerScript.setTarget(componentsPath + `${moduleName}/lib${moduleName}.a`, `bluescript_main0_${Session.moduleNameToId(moduleName)}`)
  linkerScript.setExternalSymbols(bsRuntime.readAllSymbols())
  linkerScript.setInputFiles(components)
  linkerScript.save(`./temp-files/${moduleName}.ld`)
}

main(process.argv[2])