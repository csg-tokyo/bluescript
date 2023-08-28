import { integer, newArray, arrayLength, assert } from "./utils";

const RESULT = 10;

// index of list elements
const val = 0;
const next = 0;

function listLength(e: any[]) {
    if (arrayLength(e[next]) === 0) {
        return 1;
    }
    return 1 + listLength(e[next]);
}

function isShorterThan(x: any[], y: any[]) {
    let xTail = x;
    let yTail = y;

    while (arrayLength(yTail[next]) !== 0) {
        if (arrayLength(xTail[next]) === 0) {
            return true;
        }
        xTail = xTail[next];
        yTail = yTail[next];
    }
    return false;
}

function tail(x: any[], y: any[], z: any[]): any[] {
    if (isShorterThan(y, x)) {
        return tail(
            tail(x[next], y, z),
            tail(y[next], z, x),
            tail(z[next], x, y)
        )
    }
    return z;
}

function makeList(length: integer) {
    if (length === 0) {
        return [];
    }
    const e: any[] = [length, []];
    e[next] = makeList(length - 1) as any;
    return e;
}

function list(): integer {
    let l: any[] = tail(makeList(15), makeList(10), makeList(6));
    return listLength(l);
}

function verifyResult(result: integer) {
    return result === RESULT;
}


const result = list();
assert(verifyResult(result));
