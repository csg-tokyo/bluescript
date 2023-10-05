import {integer} from "../lib/utils"
import {console_log_integer, initPWM, setPWMDuty, waitMs} from "../lib/hardwarelib/hardwarelib" 


const leftForwardPin = 5;
const leftBackPin = 13;
const rightForwardPin = 12;
const rightBackPin = 2;

const leftForwardChannel = 0;
const leftBackChannel = 1;
const rightForwardChannel = 2;
const rightBackChannel = 3;

const leftTimerId = 0;
const rightTimerId = 1;


function goForward() {
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
    waitMs(1000);
    console_log_integer(3);
}

