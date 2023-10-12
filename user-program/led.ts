import {integer} from "../lib/utils"
import {waitMs, configLED, setLEDPixel, refreshLED, clearLED} from "../lib/hardwarelib/hardwarelib" 

const ledPinId = 15;
const numLED = 10;
const ledChannel = 0;


function setup() {
    configLED(ledChannel, ledPinId, numLED);
    clearLED();
}

function loop() {
    // LED ON
    for (let i = 0; i < numLED; i++) {
        setLEDPixel(i, 255, 0, 0);
    }
    refreshLED();
    waitMs(1000);

    // LED OFF
    clearLED();
    waitMs(1000);
}