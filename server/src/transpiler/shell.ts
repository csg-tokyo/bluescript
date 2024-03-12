import { transpile } from './code-generator/code-generator'
import * as fs from 'fs'
import { execSync, spawn } from 'child_process'
import * as readline from 'node:readline/promises'
import { ErrorLog } from './utils'

const dir = './temp-files'
const cRuntimeDir = '../esp32/components/c-runtime'
const prologCcode = `#include "../${cRuntimeDir}/c-runtime.h"
`

const prolog = `// predefined native functions
function print(m: any) {}
function print_i32(m: integer) {}
function performance_now(): integer { return 0 }
`

export function buildShell() {
  const srcdir = 'src/transpiler'
  execSync(`cc -DTEST64 -O2 -shared -fPIC -o ${dir}/c-runtime.so ${cRuntimeDir}/c-runtime.c ${srcdir}/shell-builtins.c`)
  execSync(`cc -DTEST64 -O2 -o ${dir}/shell ${srcdir}/shell.c ${dir}/c-runtime.so`)
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

export async function mainLoop() {
    const prompt = '\x1b[1;94m> \x1b[0m'
    let sessionId = 1
    const result1 = transpile(sessionId++, prolog)
    let globalNames = result1.names
    const consoleDev = readline.createInterface(process.stdin, process.stdout, completer)
    let finished = -1
    const shell = makeShell(code => { finished = code ? code : 1 })

    let libs = `${dir}/c-runtime.so`
    let sources = ''
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
        const result = transpile(sessionId, line, globalNames)

        const fileName = `${dir}/bscript${sessionId}`
        fs.writeFileSync(`${fileName}.c`, prologCcode + result.code)

        // throw an Error when compilation fails.
        execSync(`cc -shared -DTEST64 -O2 -o ${fileName}.so ${fileName}.c ${libs}`)

        libs =`${libs} ${fileName}.so`
        sources = `${sources} ${fileName}.c`
        globalNames = result.names
        shell.stdin.cork()
        shell.stdin.write(`${fileName}.so\n${result.main}\n`)
        process.nextTick(() => shell.stdin.uncork())
        sessionId += 1
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
    (libs + sources).split(' ').forEach(name => fs.rmSync(name))
}

buildShell()

process.stdout.write(`\x1b[1;94mBlueScript Shell\x1b[0m
  print(v: any), print_i32(v: integer), and performance_now() are available.
  Type '.load <file name>' to load a source file.
  Type '.quit' or 'Ctrl-D' to exit.
`)

mainLoop()
