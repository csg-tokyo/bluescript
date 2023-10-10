import {integer} from "../lib/utils"
import {console_log_integer, initPWM, setPWMDuty, stopPWM, waitMs} from "../lib/hardwarelib/hardwarelib" 


const leftForwardPin = 13;  // M1B
const leftBackPin = 14;     // M1A
const rightForwardPin = 15; // M2B
const rightBackPin = 12;    // M2A

const leftForwardChannel = 0;
const leftBackChannel = 1;
const rightForwardChannel = 2;
const rightBackChannel = 3;

const leftTimerId = 0;
const rightTimerId = 1;


function goForward() {
    stopPWM(leftForwardChannel);
    stopPWM(leftForwardChannel);
    stopPWM(rightForwardChannel);
    stopPWM(rightBackChannel);
    setPWMDuty(leftForwardChannel, 0.5);
    setPWMDuty(rightForwardChannel, 0.5);
}

function setup() {
    initPWM(leftForwardChannel, leftTimerId, leftForwardPin);
    initPWM(leftBackChannel, leftTimerId, leftBackPin);

    initPWM(rightForwardChannel, rightTimerId, rightForwardPin);
    initPWM(rightBackChannel, rightTimerId, rightBackPin);

    goForward();
}

function loop() {
    waitMs(10000);
    console_log_integer(3);
}

