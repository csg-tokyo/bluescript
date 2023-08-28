import { integer, newArray, assert } from "./utils";

const SIZE = 5000;
const RESULT = 669;

function sieve(flags: integer[], size: integer): integer {
    let primeCount = 0;

    for (let i = 2; i < size + 1; i++) {
        if (flags[i - 1] == 1) {
            primeCount += 1;
            let k = i * 2;
            while (k <= size) {
                flags[k - 1] = 0;
                k += i;
            }
        }
    }
    
    return primeCount;
}

function verify_result(result: integer) {
    return result === RESULT;
}


let flags: integer[] = new Array<integer>(SIZE, 1);
const result = sieve(flags, SIZE);
assert(verify_result(result));
