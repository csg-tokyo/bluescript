import { test } from 'uvu';
import * as assert from 'uvu/assert';

import * as tested from "../src/transpile.js"

test('syntax error', () => {
    const src = `function foo(x: float) : number {
        return x + 1 k
    }`

    try {
        const ast = tested.transpile(src, 6)
    } catch (e: any) {
        assert.is(e.messages[0].line, 7, 'line number')
        assert.is(e.messages[0].column, 20, 'column number')
    }
})

test.run()

