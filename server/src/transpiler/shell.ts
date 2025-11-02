// Copyright (C) 2024- Shigeru Chiba.  All rights reserved.

import * as fs from 'fs'
import * as path from 'path'
import { execSync, spawn } from 'child_process'
import * as readline from 'node:readline/promises'
import { ErrorLog } from './utils'
import { GlobalVariableNameTable } from './code-generator/variables'
import { Transpiler } from './transpiler'
import { ChildProcessWithoutNullStreams } from 'node:child_process'

const baseDir = path.normalize(path.dirname(process.argv[1]) + '/../../..')

const dir = `${baseDir}/server/temp-files`
const cRuntimeH = `${baseDir}/microcontroller/core/include/c-runtime.h`
const cRuntimeC = `${baseDir}/microcontroller/core/src/c-runtime.c`
const prologCcode = `#include "${cRuntimeH}"\n`
const shellBuiltins = `${baseDir}/server/src/transpiler/shell-builtins`

const shellC = `${baseDir}/server/src/transpiler/shell.c`

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

class ShellTranspiler extends Transpiler {
  finished: number = -1
  libs: string = ''
  shellCommands: string = ''
  sources: string
  shell: ChildProcessWithoutNullStreams

  static cRuntimeSo = `${dir}/c-runtime.so`

  constructor() {
    super(1)

    const filename = `${shellBuiltins}.ts`
    const code = Transpiler.fileRead(filename)
    const result = Transpiler.transpile(this.sessionId, code)

    this.baseGlobalNames = result.names
    this.sources = ShellTranspiler.buildShell(result.code)
    this.shell = ShellTranspiler.runShell(code => { this.finished = code ? code : 1 })
  }

  static buildShell(code: string) {
    const cFile = `${dir}/${shellBuiltins.split('/').pop()}.c`
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(cFile, prologCcode + code)
    execSync(`cc -DTEST64 -O2 -shared -fPIC -o ${this.cRuntimeSo} ${cRuntimeC} ${cFile}`)
    execSync(`cc -DTEST64 -O2 -o ${dir}/shell ${shellC} ${this.cRuntimeSo} -lm -ldl`)
    return cFile
  }

  static runShell(closer: (code: number) => void) {
    const shell = spawn(`${dir}/shell`)
    shell.stdout.setEncoding('utf8')
    shell.stderr.setEncoding('utf8')
    shell.stdout.pipe(process.stdout)
    shell.stderr.pipe(process.stderr)
    shell.on('close', closer)
    return shell
  }

  stopShell() {
      this.shell.stdin.end()
  }

  evaluate(code: string, dirname: string, globalNames: GlobalVariableNameTable, consoleDev: readline.Interface) {
    try {
      return this.transpile(code, globalNames, dirname)
      // don't call consoleDev.prompt() here.
      // the prompt is printed in shell.c.
    }
    catch (e) {
      if (e instanceof ErrorLog)
        process.stdout.write(e.toString())
      else if (e instanceof Error)
        process.stdout.write(`Error: ${e.message}\n`)
      else
        process.stdout.write('Error: compilation failure\n')

      consoleDev.prompt()
      return globalNames
    }
  }

  override compileModule(code: string, main: string) {
    const fileName = `${dir}/bscript${this.sessionId}_${this.moduleId}`
    this.compile(code, main, fileName)
  }

  override compileCode(code: string, main: string) {
    const fileName = `${dir}/bscript${this.sessionId}`
    this.compile(code, main, fileName)
    this.shell.stdin.cork()
    this.shell.stdin.write(this.shellCommands)
    this.shellCommands = ''
    process.nextTick(() => this.shell.stdin.uncork())
  }

  private compile(src: string, main: string, fileName: string) {
    fs.writeFileSync(`${fileName}.c`, prologCcode + src)

    // throw an Error when compilation fails.
    execSync(`cc -DTEST64 -O2 -shared -fPIC -o ${fileName}.so ${fileName}.c ${ShellTranspiler.cRuntimeSo} ${this.libs}`)
    this.libs =`${this.libs} ${fileName}.so`
    this.sources = `${this.sources} ${fileName}.c`
    this.shellCommands += `${fileName}.so\n${main}\n`
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

function loadAndRun(globalNames: GlobalVariableNameTable, transpiler: ShellTranspiler, consoleDev: readline.Interface) {
  for (const source of process.argv.slice(2)) {
    const code = fs.readFileSync(source).toString('utf-8')
    if (code === '')
      break
    else
      globalNames = transpiler.evaluate(code, path.dirname(source), globalNames, consoleDev)
  }

  return globalNames
}

export async function mainLoop() {
    const prompt = '\x1b[1;94m> \x1b[0m'
    const consoleDev = readline.createInterface(process.stdin, process.stdout, completer)

    const transpiler = new ShellTranspiler()
    let globalNames = transpiler.getBaseGlobalNames()
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
        transpiler.finished = 0
        break
      }

      globalNames = transpiler.evaluate(line, dirname, globalNames, consoleDev)
      if (transpiler.finished >= 0)
            break
    }

    transpiler.stopShell();
    `${transpiler.libs} ${transpiler.sources}`.split(' ').forEach(name => name === '' || fs.rmSync(name))
}

console.log(execSync("pwd").toString())

process.stdout.write(`\x1b[1;94mBlueScript Shell\x1b[0m
  # npm run shell <source file> ...
  Type '.load <file name>' to load a source file.
  Type '.quit' or 'Ctrl-D' to exit.
  print(v: any), print_i32(v: integer), and performance_now() are available.
`)

mainLoop()
