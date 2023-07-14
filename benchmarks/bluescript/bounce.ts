import { integer, newArray, assert, abs } from "./utils";

const RESULT = 1331;

// random
let randomSeed = 74755;

function randomNext() {
    randomSeed = ((randomSeed * 1309) + 13849) & 65535;
    return randomSeed;
}
// finish random

// index of each ball elements.
const x = 0;
const y = 1;
const xVel = 2;
const yVel = 3;

function ballBounce(ball: integer[]) {
    let xLimit = 500;
    let yLimit = 500;
    let bounced = false;

    ball[x] = ball[x] + ball[xVel];
    ball[y] = ball[y] + ball[yVel];

    if (ball[x] > xLimit) {
        ball[x] = xLimit;
        ball[xVel] = -abs(ball[xVel]);
        bounced = true
    }
    if (ball[x] < 0) {
        ball[x] = 0;
        ball[xVel] = abs(ball[xVel]);
        bounced = true;
    }
    if (ball[y] > yLimit) {
        ball[y] = yLimit;
        ball[yVel] = -abs(ball[yVel]);
        bounced = true;
    }
    if (ball[y] < 0) {
        ball[y] = 0;
        ball[yVel] = abs(ball[yVel]);
        bounced = true;
    }
    return bounced;
}

function bounce(): integer {
    randomSeed = 74755;
    let ballCount = 100;
    let bounces = 0;
    let balls: any[] = newArray(ballCount, 0);
    for (let i = 0; i < ballCount; i++) {
        let ball: integer[] = [
            randomNext() % 500,
            randomNext() % 500,
            (randomNext() % 300) - 150,
            (randomNext() % 300) - 150
        ];
        balls[i] = ball as any;
    }
    for (let i = 0; i < 50; i++) {
        for (let b = 0; b < ballCount; b++) {
            if (ballBounce(balls[b])) {
                bounces += 1;
            }
        }
    }
    return bounces;
}

function verify_result(result: integer) {
    return result === RESULT;
}


const result = bounce();
assert(verify_result(result));
