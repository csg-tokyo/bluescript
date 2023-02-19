import * as babelParser from '@babel/parser'
import AST from '@babel/types'
import TypeChecker from './typechecker'
import { ErrorLog } from './utils'

export function transpile(src: string, startLine: number = 1) {
    const ast = runBabelParser(src, startLine)
    const tchecker = new TypeChecker()
    const env = tchecker.run(ast)
    return [ast.program.body, env];
}

function runBabelParser(src: string, startLine: number): AST.File {
    const options: babelParser.ParserOptions = { plugins: ['typescript'],
                                                 startLine: startLine }
    try {
        return babelParser.parse(src, options)
    } catch (e: any) {
        if ('name' in e && e.name == 'SyntaxError') {
            const msg = `${e.name}: ${e.message}`
            throw new ErrorLog().pushError(msg, e.loc.line, e.loc.column)
        }
        else
            throw e
    }
}
