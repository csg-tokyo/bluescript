// Copyright (C) 2024- Shigeru Chiba.  All rights reserved.

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { ErrorLog } from './utils'
import { GlobalVariableNameTable } from './code-generator/variables'
import { Transpiler } from './transpiler'

const baseDir = path.normalize(path.dirname(process.argv[1]) + '/../../..')

const dir = `${baseDir}/server/temp-files`
const cRuntimeH = `${baseDir}/microcontroller/core/include/c-runtime.h`
const cRuntimeC = `${baseDir}/microcontroller/core/src/c-runtime.c`
const prologCcode = `#include "${cRuntimeH}"\n`
const shellBuiltins = `${baseDir}/server/src/transpiler/shell-builtins`

class Compiler extends Transpiler {
  libs: string
  sources: string
  mains: string[]

  constructor() {
    super(1)

    const filename = `${shellBuiltins}.ts`
    const code = Compiler.fileRead(filename)
    const result = Transpiler.transpile(this.sessionId, code)
    this.baseGlobalNames = result.names

    const cFile = `${dir}/${path.basename(shellBuiltins)}.c`
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(cFile, prologCcode + result.code)
    this.sources = cFile
    this.libs = `${cRuntimeC.replace('.c', '.o')} ${cFile.replace('.c', '.o')}`
    this.mains = []
  }

  compileSource(fileName: string, globalNames: GlobalVariableNameTable) {
    try {
      const dirname = path.dirname(fileName)
      const code = Compiler.loadSourceFile(fileName)
      return this.transpile(code, globalNames, dirname)
    }
    catch (e) {
      if (e instanceof ErrorLog)
        process.stdout.write(`Error in ${fileName}\n${e.toString()}`)
      else if (e instanceof Error)
        process.stdout.write(`Error: ${e.message}\n`)
      else
        process.stdout.write(`Error: compilation failure: ${fileName}\n`)

      return globalNames
    }
  }

  static loadSourceFile(file: string) {
    try {
      const src = fs.readFileSync(file)
      return src.toString('utf-8')
    }
    catch (e) {
      throw new Error(`no such file: ${file}\n`)
    }
  }

  override compileModule(code: string, main: string) {
    const fileName = `${dir}/bscript${this.sessionId}_${this.moduleId}`
    this.compile(code, main, fileName)
  }

  override compileCode(code: string, main: string) {
    const fileName = `${dir}/bscript${this.sessionId}`
    this.compile(code, main, fileName)
  }

  private compile(src: string, main: string, fileName: string) {
    fs.writeFileSync(`${fileName}.c`, prologCcode + src)
    this.libs = `${this.libs} ${fileName}.o`
    this.sources = `${this.sources} ${fileName}.c`
    this.mains.push(main)
  }
}

function help() {
    console.log(`Usage: node compiler.js [options] source-file1 source-file2 ...
  options:
    -args=ARG1,ARG2,...
    +args=ARG1,ARG2,...    ARG1 and ARG2 are passed to the compiler
    -g or +g               do not remove work files.

Example:
  node compiler.js -args=-g,-o,foo src/foo.bs src/lib.bs
  This compiles src/foo.bs and src/lib.bs with compiler options: -g -o foo`)
}

function main() {
  if (process.argv.length < 3) {
    help()
    return
  }

  const compiler = new Compiler()
  let globalNames = compiler.getBaseGlobalNames()
  let options = ''
  let debug = false
  for (const src of process.argv.slice(2))
    if (src.startsWith('-args=') || src.startsWith('+args='))
      options += src.substring(6).replace(/,/g, ' ') + ' '
    else if (src === '-g' || src === '+g')
      debug = true
    else
      globalNames = compiler.compileSource(src, globalNames)

  const mainFile = `${dir}/a.c`

  fs.writeFileSync(mainFile, `
    ${prologCcode}
    ${compiler.mains.map(name => `extern void ${name}();`).join('\n')}
    int main() {
      gc_initialize();
      int r = 0;
      ${compiler.mains.map(name => `r = try_and_catch(${name}); if (!r) return r;`).join('\n')}
      return 0;
    }`)

  const cmd = `cc -DLINUX64 -O2 ${options} ${mainFile} ${compiler.sources} ${cRuntimeC} -lm`
  execSync(cmd)
  if (debug)
    console.log(cmd)
  else
    `${compiler.sources} ${mainFile}`.split(' ').forEach(name => name === '' || fs.rmSync(name))
}

main()
