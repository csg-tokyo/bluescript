import { integer, assert, newArray } from "./utils";

const RESULT = 8660;

function swap(v: any[], i: integer, j: integer) {
    const tmp = v[i];
    v[i] = v[j];
    v[j] = tmp;
}

function permute(n: integer, v: any[]) {
    count += 1;
    if (n != 0) {
        let n1 = n - 1;
        permute(n1, v);
        for (let i = n1; i > -1; i--) {
            swap(v, n1, i);
            permute(n1, v);
            swap(v, n1, i);
        }
    }
}

function verify_result(result: integer) {
    return result === RESULT;
}

let count = 0;
let arr: any[] = newArray(6, 0);
permute(6, arr);
assert(verify_result(count));
