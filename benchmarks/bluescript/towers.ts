import { integer, newArray, arrayLength,  assert } from "./utils";

const RESULT = 8191;

// id of tower disk elements.
const size = 0;
const next = 1;

let piles: any[][] = [[], [], []];
let movesDone = 0;

function pushDisk(disk: any[], pile: integer) {
    let top = piles[pile];
    if ((arrayLength(top) === 2) && disk[size] >= top[size]) {
        assert(false);
    }
    disk[next] = top as any;
    piles[pile] = disk;
}

function popDiskFrom(pile: integer) {
    let top = piles[pile];
    if (arrayLength(top) === 0) {
        assert(false);
    }
    piles[pile] = top[next] as any[];
    top[next] = [] as any;
    return top;
}

function moveTopDisk(fromPile: integer, toPile: integer) {
    pushDisk(popDiskFrom(fromPile), toPile);
    movesDone += 1;
}

function buildTowerAt(pile: integer, disks: integer) {
    for (let i = disks; i > -1; i--) {
        pushDisk([i, null], pile);
    }
}

function moveDisks(disks: integer, fromPile: integer, toPile: integer) {
    if (disks === 1) {
        moveTopDisk(fromPile, toPile);
    } else {
        let otherPile = (3 - fromPile) - toPile;
        moveDisks(disks - 1, fromPile, otherPile);
        moveTopDisk(fromPile, toPile);
        moveDisks(disks - 1, otherPile, toPile);
    }
}


function towers() {
    let piles = [[], [], []];
    buildTowerAt(0, 13);
    movesDone = 0;
    moveDisks(13, 0, 1);
    return movesDone;
}

function verifyResult(result: integer) {
    return result === RESULT;
}

let result = towers();
assert(verifyResult(result));
