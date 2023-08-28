import { integer, newArray, assert } from "./utils";

const RESULT = 5461;

// random
let randomSeed = 74755;

function randomNext() {
    randomSeed = ((randomSeed * 1309) + 13849) & 65535;
    return randomSeed;
}
// finish random

let count = 0;

function buildTreeDepth(depth: integer) {
    count += 1;
    if (depth == 1) {
        return newArray(randomNext() % 10 + 1, 0);
    }

    let arr = newArray(4, 0);
    for (let i = 0; i < 4; i++) {
        arr[i] = buildTreeDepth(depth - 1) as any;
    }
    return arr;
}

function storage() {
    randomSeed = 74755;
    randomSeed = 0;
    buildTreeDepth(7);
   return count;
}

function verifyResult(result: integer) {
    return result === RESULT;
}

let result = storage();
assert(verifyResult(result));
