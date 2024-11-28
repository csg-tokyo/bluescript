import {LinkerScript} from "../linker/linker-script";
import * as fs from "fs";
import {ExecutableElfReader} from "../linker/elf-reader";
import {FILE_PATH} from "../constants";

const componentsPath = '/Users/maejimafumika/Desktop/Lab/research/bluescript/microcontroller/ports/esp32/build/esp-idf/'
const targetObjFilePath = '../microcontroller/ports/esp32/build/esp-idf/gpio_103112105111/libgpio_103112105111.a'

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
  console.log(componentPaths)
  return componentPaths

}


function main() {
  let components = getComponents('gpio_103112105111')
  // let archives = (fs.readdirSync(componentsPath, {recursive: true}) as string[])
  //                   .filter(fname => fname.endsWith('.a'))
  const bsRuntime = new ExecutableElfReader(FILE_PATH.MCU_ELF);

  const linkerScript = new LinkerScript(0x310000, 0x410000, components)
  linkerScript.setTarget(componentsPath + 'gpio_103112105111/libgpio_103112105111.a', 'bluescript_main0_103112105111')
  linkerScript.setExternalSymbols(bsRuntime.getAllSymbols())
  linkerScript.save('./gpio_103112105111.ld')
}

main()