import {integer} from "../lib/utils"
import {waitMs, configLED, setLEDPixel, refreshLED, clearLED, createOneShotTimer, startOneShotTimer, console_log_integer} from "../lib/hardwarelib/hardwarelib" 

let target:integer = 0;

function timerCb() {
    target = 3;
}

function setup() {
    createOneShotTimer(timerCb);
    startOneShotTimer(3000000)
}

function loop() {
    console_log_integer(target);
    waitMs(500);
}