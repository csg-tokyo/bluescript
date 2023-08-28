import { integer, assert } from "./utils";

const RESULT = 8660;

function swap(v: integer[], i: integer, j: integer) {
    const tmp = v[i];
    v[i] = v[j];
    v[j] = tmp;
}

function permute(v: integer[], n: integer) {
    count += 1;
    if (n != 0) {
        let n1 = n - 1;
        permute(v, n1);
        for (let i = n1; i > -1; i--) {
            swap(v, n1, i);
            permute(v, n1);
            swap(v, n1, i);
        }
    }
}

function verify_result(result: integer) {
    return result === RESULT;
}

let count = 0;
let arr = new Array<integer>(6, 0);
permute(arr, 6);
assert(verify_result(count));