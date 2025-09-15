// Copyright (C) 2024- Shigeru Chiba.  All rights reserved.

import { transpile } from './code-generator/code-generator'
import * as fs from 'fs'
import * as path from 'path'
import { execSync, spawn } from 'child_process'
import * as readline from 'node:readline/promises'
import { ErrorLog } from './utils'
import { GlobalVariableNameTable } from './code-generator/variables'
import { ChildProcessWithoutNullStreams } from 'node:child_process'

const dir = './temp-files'
const cRuntimeH = "../microcontroller/core/include/c-runtime.h"
const cRuntimeC = "../microcontroller/core/src/c-runtime.c"
const prologCcode = `#include "../${cRuntimeH}"
`
const shellBuiltins = 'src/transpiler/shell-builtins'
const shellC = 'src/transpiler/shell.c'

export function buildShell(): [number, GlobalVariableNameTable, string] {
  const sessionId = 1
  const src = loadSourceFile(`${shellBuiltins}.ts`)
  const result = transpile(sessionId, src)
  const cFile = `${dir}/${shellBuiltins.split('/').pop()}.c`
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(cFile, prologCcode + result.code)

  execSync(`cc -DTEST64 -O2 -shared -fPIC -o ${dir}/c-runtime.so ${cRuntimeC} ${cFile}`)
  execSync(`cc -DTEST64 -O2 -o ${dir}/shell ${shellC} ${dir}/c-runtime.so -lm -ldl`)
  return [sessionId, result.names, cFile]
}

function makeShell(closer: (code: number) => void) {
  const shell = spawn(`${dir}/shell`)
  shell.stdout.setEncoding('utf8')
  shell.stderr.setEncoding('utf8')
  shell.stdout.pipe(process.stdout)
  shell.stderr.pipe(process.stderr)
  shell.on('close', closer)
  return shell
}

class CodeBuffer {
  private buffer: string = ''
  private level = 0

  append(line: string) {
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '(' || c === '{' || c === '[')
        this.level++
      else if (c === ')' || c === '}' || c === ']')
        this.level--
    }

    if (this.buffer == '')
      this.buffer = line
    else
      this.buffer = `${this.buffer}\n${line}`

    if (this.level > 0)
      return null
    else {
      this.level = 0
      const buf = this.buffer
      this.buffer = ''
      return buf
    }
  }
}

function completer(line: string): [string[], string] {
  const completions = '.quit .load print print_i32 performance_now function let const class'.split(' ')
  const hits = completions.filter((c) => c.startsWith(line))
  return hits.length ? [hits, line] : [[], '']
}

class Transpiler {
  shell: ChildProcessWithoutNullStreams
  baseGlobalNames: GlobalVariableNameTable
  sessionId: number
  moduleId: number
  modules: Map<string, GlobalVariableNameTable>
  libs: string
  sources: string

  constructor(sessionId: number, names: GlobalVariableNameTable, srcFile: string, shell: ChildProcessWithoutNullStreams) {
    this.shell = shell
    this.sessionId = sessionId
    this.moduleId = 0
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.libs = `${dir}/c-runtime.so`
    this.sources = srcFile
    this.baseGlobalNames = names
  }


  tryEvaluate(code: string, dirname: string, globalNames: GlobalVariableNameTable, consoleDev: readline.Interface) {
    try {
      return this.evaluate(code, dirname, globalNames)
      // don't call consoleDev.prompt() here.
      // the prompt is printed in shell.c.
    }
    catch (e) {
      if (e instanceof ErrorLog)
        process.stdout.write(e.toString())
      else
        process.stdout.write('Error: compilation failure\n')

      consoleDev.prompt()
      return globalNames
    }
  }

  evaluate(src: string, dirname: string, globalNames: GlobalVariableNameTable) {
    const compile = (src: string, fileName: string) => {
      fs.writeFileSync(`${fileName}.c`, prologCcode + src)

      // throw an Error when compilation fails.
      execSync(`cc -DTEST64 -O2 -shared -fPIC -o ${fileName}.so ${fileName}.c ${this.libs}`)
      this.libs =`${this.libs} ${fileName}.so`
      this.sources = `${this.sources} ${fileName}.c`
    }

    const fileReader = (fname: string) => {
      try {
        if (!fs.existsSync(fname))
          fname += '.ts'

        return fs.readFileSync(fname).toString('utf-8')
      }
      catch (e) {
        throw `cannot find a module ${fname}`
      }
    }

    const importer = (baseName: string) => (name: string) => {
      const fname = path.isAbsolute(name) ? name : path.join(baseName, name)
      const mod = this.modules.get(fname)
      if (mod)
        return mod
      else {
        const program = fileReader(fname)
        this.moduleId += 1
        this.sessionId += 1
        const fileName = `${dir}/bscript${this.sessionId}_${this.moduleId}`
        const result = transpile(this.sessionId, program, this.baseGlobalNames, importer(path.dirname(fname)), this.moduleId)
        this.modules.set(fname, result.names)
        compile(result.code, fileName)
        shellCommands += `${fileName}.so\n${result.main}\n`
        return result.names
      }
    }

    let shellCommands = ''
    this.sessionId += 1
    const fileName = `${dir}/bscript${this.sessionId}`
    const result = transpile(this.sessionId, src, globalNames, importer(dirname))
    compile(result.code, fileName)
    this.shell.stdin.cork()
    this.shell.stdin.write(`${shellCommands}${fileName}.so\n${result.main}\n`)
    process.nextTick(() => this.shell.stdin.uncork())
    return result.names
  }
}

function loadSourceFile(file: string) {
  try {
    const src = fs.readFileSync(file)
    return src.toString('utf-8')
  }
  catch (e) {
    process.stdout.write(`Error: no such file: ${file}\n`)
    return ''
  }
}

function loadAndRun(globalNames: GlobalVariableNameTable, transpiler: Transpiler, consoleDev: readline.Interface) {
  for (const source of process.argv.slice(2)) {
    const code = loadSourceFile(source)
    if (code !== '')
      globalNames = transpiler.tryEvaluate(code, path.dirname(source), globalNames, consoleDev)
  }

  return globalNames
}

export async function mainLoop() {
    const [sessionId, names, fileName] = buildShell()
    const prompt = '\x1b[1;94m> \x1b[0m'
    const consoleDev = readline.createInterface(process.stdin, process.stdout, completer)
    let finished = -1
    const shell = makeShell(code => { finished = code ? code : 1 })

    const transpiler = new Transpiler(sessionId, names, fileName, shell)
    let globalNames = transpiler.baseGlobalNames
    consoleDev.setPrompt(prompt)
    consoleDev.prompt()
    if (process.argv.length >= 3) {
      process.stdout.write('\n')
      globalNames = loadAndRun(globalNames, transpiler, consoleDev)
    }

    const codeBuffer = new CodeBuffer()
    for await (const oneline of consoleDev) {
      let line = codeBuffer.append(oneline)
      if (line !== null)
        consoleDev.setPrompt(prompt)
      else {
        consoleDev.setPrompt('  ')
        consoleDev.prompt()
        continue
      }

      let dirname = '.'
      if (line.startsWith('.load ')) {
        const file = line.split(' ')[1]
        line = loadSourceFile(file)
        dirname = path.dirname(file)
      }

      if (line === '') {
        consoleDev.prompt()
        continue
      }
      else if (line === '.quit') {
        consoleDev.close()
        finished = 0
        break
      }

      globalNames = transpiler.tryEvaluate(line, dirname, globalNames, consoleDev)
      if (finished >= 0)
            break
    }

    shell.stdin.end();
    `${transpiler.libs} ${transpiler.sources}`.split(' ').forEach(name => fs.rmSync(name))
}

console.log(execSync("pwd").toString())

process.stdout.write(`\x1b[1;94mBlueScript Shell\x1b[0m
  # npm run shell <source file> ...
  Type '.load <file name>' to load a source file.
  Type '.quit' or 'Ctrl-D' to exit.
  print(v: any), print_i32(v: integer), and performance_now() are available.
`)

mainLoop()
