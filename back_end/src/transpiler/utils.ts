import AST, {Node, SourceLocation} from '@babel/types'
import * as babelParser from "@babel/parser";

export function runBabelParser(src: string, startLine: number): AST.File {
  const options: babelParser.ParserOptions = { sourceType: 'module', plugins: ['typescript'], startLine }
  try {
    return babelParser.parse(src, options)
  } catch (e: any) {
    if ('name' in e && e.name === 'SyntaxError') {
      const msg = `${e.name}: ${e.message}`
      throw new ErrorLog().pushError(msg, e.loc.line, e.loc.column)
    }
    else
      throw e
  }
}

export class ErrorLog {
  messages: {
    message: string,
    location?: SourceLocation | null
  }[]

  constructor() {
    this.messages = []
  }

  hasError(): boolean {
    return this.messages.length > 0
  }

  toString() {
    let text = ''
    for (const m of this.messages) {
      const line = m.location?.start.line
      text += `${m.message} in line ${line ? line : '??'}\n`
    }
    return text
  }

  push(msg: string, node: Node): this {
    this.messages.push({message: msg, location: node.loc})
    return this
  }

  pushError(msg: string, line: number, col: number) {
    const loc = {
      start: {line, column: col},
      end: {line, column: col + 1}
    }
    this.messages.push({message: msg, location: loc})
    return this
  }
}

export class CodeWriter {
  private static indentSpaces = ['', '  ', '    ', '      ', '        ',
                                 '          ']
  private code = ''
  private indentLevel = 0
  private spaceIndex = 0

  copy() {
    const writer = new CodeWriter()
    writer.indentLevel = this.indentLevel
    return writer
  }

  getCode() { return this.code }

  write(text: string) {
    this.code += text
    return this
  }

  right() {
    this.updateIndent(++this.indentLevel)
    return this
  }

  left() {
    this.updateIndent(--this.indentLevel)
    return this
  }

  updateIndent(level: number) {
    if (level >= CodeWriter.indentSpaces.length)
      this.spaceIndex = CodeWriter.indentSpaces.length - 1
    else if (level < 0)
      this.spaceIndex = 0
    else
      this.spaceIndex = level
  }

  nl() {    // new line
    this.code += '\n'
    this.code += CodeWriter.indentSpaces[this.spaceIndex]
    return this
  }
}
