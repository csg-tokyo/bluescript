import { transpile } from './code-generator/code-generator'
import * as fs from 'fs'
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

const prolog = `// predefined native functions
function print(m: any) {}
function print_i32(m: integer) {}
function performance_now(): integer { return 0 }
`

export function buildShell() {
  const srcdir = 'src/transpiler'
  console.log(execSync("pwd").toString())
  execSync(`cc -DTEST64 -O2 -shared -fPIC -o ${dir}/c-runtime.so ${cRuntimeC} ${srcdir}/shell-builtins.c`)
  execSync(`cc -DTEST64 -O2 -o ${dir}/shell ${srcdir}/shell.c ${dir}/c-runtime.so -lm -ldl`)
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

function completer(line: string) {
  const completions = '.quit .load print print_i32 performance_now function let const class'.split(' ')
  const hits = completions.filter((c) => c.startsWith(line))
  return hits.length ? [hits, line] : [[], '']
}

function loadSourceFile(line: string) {
  if (!line.startsWith('.load '))
    return line

  const cmd = line.split(' ')
  try {
    const src = fs.readFileSync(cmd[1])
    return src.toString('utf-8')
  }
  catch (e) {
    process.stdout.write(`Error: no such file: ${cmd[1]}\n`)
    return ''
  }
}

class Transpiler {
  shell: ChildProcessWithoutNullStreams
  baseGlobalNames: GlobalVariableNameTable
  sessionId: number
  moduleId: number
  modules: Map<string, GlobalVariableNameTable>
  shellCommands: string
  libs: string
  sources: string

  constructor(shell: ChildProcessWithoutNullStreams) {
    this.shell = shell
    this.sessionId = 0
    this.moduleId = 0
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.shellCommands = ''
    this.libs = `${dir}/c-runtime.so`
    this.sources = ''

    const result = transpile(++this.sessionId, prolog)
    this.baseGlobalNames = result.names
  }

  transpile(src: string, globalNames: GlobalVariableNameTable) {
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

    const importer = (fname: string) => {
      const mod = this.modules.get(fname)
      if (mod)
        return mod
      else {
        const program = fileReader(fname)
        this.moduleId += 1
        this.sessionId += 1
        const fileName = `${dir}/bscript${this.sessionId}_${this.moduleId}`
        const result = transpile(this.sessionId, program, this.baseGlobalNames, importer, this.moduleId)
        this.modules.set(fname, result.names)
        compile(result.code, fileName)
        this.shellCommands += `${fileName}.so\n${result.main}\n`
        return result.names
      }
    }

    this.shellCommands = ''
    this.sessionId += 1
    const fileName = `${dir}/bscript${this.sessionId}`
    const result = transpile(this.sessionId, src, globalNames, importer)
    compile(result.code, fileName)
    this.shell.stdin.cork()
    this.shell.stdin.write(`${this.shellCommands}${fileName}.so\n${result.main}\n`)
    process.nextTick(() => this.shell.stdin.uncork())
    return result.names
  }
}

export async function mainLoop() {
    const prompt = '\x1b[1;94m> \x1b[0m'
    const consoleDev = readline.createInterface(process.stdin, process.stdout, completer)
    let finished = -1
    const shell = makeShell(code => { finished = code ? code : 1 })

    const transpiler = new Transpiler(shell)
    let globalNames = transpiler.baseGlobalNames
    consoleDev.setPrompt(prompt)
    consoleDev.prompt()

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

      line = loadSourceFile(line)
      if (line === '') {
        consoleDev.prompt()
        continue
      }
      else if (line === '.quit') {
        consoleDev.close()
        finished = 0
        break
      }

      try {
        globalNames = transpiler.transpile(line, globalNames)
        // don't call consoleDev.prompt() here.
        // the prompt is printed in shell.c.
      }
      catch (e) {
        if (e instanceof ErrorLog)
          process.stdout.write(e.toString())
        else
          process.stdout.write('Error: compilation failure\n')

        consoleDev.prompt()
      }

      if (finished >= 0)
            break
    }

    shell.stdin.end();
    (transpiler.libs + transpiler.sources).split(' ').forEach(name => fs.rmSync(name))
}

buildShell()

process.stdout.write(`\x1b[1;94mBlueScript Shell\x1b[0m
  print(v: any), print_i32(v: integer), and performance_now() are available.
  Type '.load <file name>' to load a source file.
  Type '.quit' or 'Ctrl-D' to exit.
`)

mainLoop()
