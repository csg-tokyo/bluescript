import * as babelParser from '@babel/parser'
import AST from '@babel/types'
import { ErrorLog } from './utils'

export function transpile(src: string, startLine: number): AST.File {
    const ast = runBabelParser(src, startLine)
    return ast;
}

function runBabelParser(src: string, startLine: number): AST.File {
    const options: babelParser.ParserOptions = { plugins: ['typescript'],
                                                 startLine: startLine }
    try {
        const ast = babelParser.parse(src, options)
        return ast
    } catch (e: any) {
        if ('name' in e && e.name == 'SyntaxError') {
            const msg = `${e.name}: ${e.message}`
            throw new ErrorLog().pushError(msg, e.loc.line, e.loc.column)
        }
        else
            throw e
    }
}
