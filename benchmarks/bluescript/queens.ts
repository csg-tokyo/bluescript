import { integer, newArray, assert } from "./utils";

let freeRows: any[];
let freeMaxs: any[];
let freeMins: any[];
let queenRows: any[];

function setRowColumn(r: integer, c: integer, v: boolean) {
    freeRows[r] = v as any;
    freeMaxs[c + r] = v as any;
    freeMins[c - r + 7] = v as any;
}

function getRowColumn(r: integer, c: integer) {
    return freeRows[r] && freeMaxs[c + r] && freeMins[c - r + 7];
}

function placeQueen(c: integer) {
    for (let r = 0; r < 8; r++) {
        if (getRowColumn(r, c)) {
            queenRows[r] = c as any;
            setRowColumn(r, c, false);
            if (c == 7) {
                return true;
            }
            if (placeQueen(c + 1)) {
                return true;
            }
            setRowColumn(r, c, true);
        }
    }
    return false;
}

function queens(): boolean {
    freeRows = newArray(8, true);
    freeMaxs = newArray(16, true);
    freeMins = newArray(16, true);
    queenRows = newArray(8, -1);
    return placeQueen(0);
}

function verifyResult(result: boolean) {
    return result;
}

let result: boolean = true;
for (let i = 0; i < 10; i++) {
    result = result && queens();
}
assert(verifyResult(result));
