import { transpile } from '../transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { GlobalVariableNameTable } from '../transpiler/code-generator/variables'
import { FILE_PATH } from '../constants'

const dir = './temp-files'

const prolog = `// predefined native functions
function print(m: any) {}
`
const cRuntimeH = "../microcontroller/core/include/c-runtime.h"
const prologCcode = `#include "../${cRuntimeH}"
`

class Transpiler {
    sessionId: number
    baseGlobalNames: GlobalVariableNameTable
    modules: Map<string, GlobalVariableNameTable>

    constructor() {
        this.sessionId = 0;
        this.modules = new Map<string, GlobalVariableNameTable>()

        const result = transpile(++this.sessionId, prolog)
        this.baseGlobalNames = result.names
    }

    private convertFname(fname: string):number {
        let result = "";
        for (let i = 0; i < fname.length; i++) {
            result += fname.charCodeAt(i);
        }
        return parseInt(result) ?? 0;
    }

    transpile(moduleName: string, globalNames: GlobalVariableNameTable) {

        const importer = (fname: string) => {
            const mod = this.modules.get(fname)
            if (mod)
                return mod
            else {
                const program = fs.readFileSync(`${FILE_PATH.MODULES_FFI}/${fname}.ts`).toString();
                const moduleId = this.convertFname(fname);
                this.sessionId += 1;
                const fileName = `${dir}/bscript${this.sessionId}_${moduleId}`;
                const result = transpile(this.sessionId, program, this.baseGlobalNames, importer, moduleId);
                fs.writeFileSync(`${fileName}.c`, prologCcode + result.code);
                this.modules.set(fname, result.names);
                return result.names;
            }
        }

        this.sessionId += 1
        const moduleId = this.convertFname(moduleName);
        const program = fs.readFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.bs`).toString();
        const fileName = `${dir}/${moduleName}_${moduleId}`;
        const result = transpile(0, program, globalNames, importer, moduleId)
        fs.writeFileSync(`${fileName}.c`, prologCcode + result.code);
        return result.names
    }
}  


function main() {
    const transpiler = new Transpiler();
    let globalNames = transpiler.baseGlobalNames
    transpiler.transpile("gpio", globalNames);
}

main();