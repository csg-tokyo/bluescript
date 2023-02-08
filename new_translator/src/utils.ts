import { Node, SourceLocation } from '@babel/types'

export class ErrorLog {
    messages: { message: string,
                location?: SourceLocation | null
              }[]

    constructor() {
        this.messages = []
    }

    push(msg: string, node: Node): this {
        this.messages.push({ message: msg, location: node.loc })
        return this
    }

    pushError(msg: string, line: number, col: number) {
        const loc = { start: { line: line, column: col },
                      end: { line: line, column: col + 1 } }
        this.messages.push({ message: msg, location: loc })
        return this
    }
}
