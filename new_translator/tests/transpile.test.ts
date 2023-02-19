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
        const loc = e.messages[0].location.start
        assert.is(loc.line, 7, 'line number')
        assert.is(loc.column, 20, 'column number')
    }
})

console.log('OK')

test.run()

