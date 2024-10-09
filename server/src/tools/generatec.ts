import { transpile } from '../transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { GlobalVariableNameTable } from '../transpiler/code-generator/variables'

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

    transpile(src: string, globalNames: GlobalVariableNameTable) {

        const importer = (fname: string) => {
            const mod = this.modules.get(fname)
            if (mod)
                return mod
            else {
                const program = fs.readFileSync(`./src/tools/${fname}.ts`).toString();
                const moduleId = 0;
                this.sessionId += 1;
                const fileName = `${dir}/bscript${this.sessionId}_${moduleId}`;
                const result = transpile(this.sessionId, program, this.baseGlobalNames, importer, moduleId);
                fs.writeFileSync(`${fileName}.c`, prologCcode + result.code);
                this.modules.set(fname, result.names);
                return result.names;
            }
        }

        this.sessionId += 1
        const fileName = `${dir}/bscript${this.sessionId}`
        const result = transpile(this.sessionId, src, globalNames, importer, 0)
        fs.writeFileSync(`${fileName}.c`, prologCcode + result.code);
        return result.names
    }
}  


function main() {
    const transpiler = new Transpiler();
    const src = fs.readFileSync(`./src/tools/test.ts`).toString();
    let globalNames = transpiler.baseGlobalNames
    transpiler.transpile(src, globalNames);
}

main();