# Blink LED

Now that you have verified your environment, let's move on to the "Real" Hello World of embedded systems: **Blinking an LED**.

In this tutorial, you will learn:
1.  How to install external packages.
2.  How to wire an LED to the ESP32.
3.  How to write code to control GPIO pins.

## Step 1: Hardware Setup

Depending on your hardware, choose one of the following setups.

### Option A: Using the Onboard LED
Most ESP32 development boards (like the ESP32-DevKitC) have a small blue LED built into the board.
*   **Pin:** Typically **GPIO 2**.
*   **Wiring:** No external wiring required.

### Option B: Using an External LED
If your board does not have an onboard LED, or if you prefer to build a circuit, connect an LED to **GPIO 23**.

**Required Parts:**
*   1x LED
*   1x Resistor (220Ω - 1kΩ)
*   Breadboard and Jumper wires

:::tip Polarity Check
Make sure to connect the **longer leg** (Anode) of the LED towards the GPIO pin (through the resistor), and the **shorter leg** (Cathode) to GND.
:::

## Step 2: Install GPIO Package

BlueScript keeps the core runtime small. To use hardware features like GPIO, we need to install the driver package.

Run the following command in your project directory:

```bash
bscript project install https://github.com/bluescript-lang/pkg-gpio-esp32.git
```

## Step 3: Write Code

Open `src/index.bs` and replace its content with the code below.

This program will blink the LED 10 times with a 1-second interval.

:::warning Select your Pin
The code below uses **GPIO 2** (Onboard LED).
If you are using the **External LED**, change `2` to `23` in the `new GPIO(...)` line.
:::

```typescript title="src/index.bs"
// Import GPIO class and Enums from the installed package
import { GPIO, PinMode, PinLevel } from "gpio";

// Initialize GPIO 2 as Input/Output mode
// CHANGE THIS TO '23' IF USING EXTERNAL LED
const led = new GPIO(2, PinMode.InputOutput);

console.log("Starting Blink Loop...");

// Blink the LED 10 times
for (let i = 0; i < 10; i++) {
    // Turn LED ON
    led.write(PinLevel.High);
    time.delay(1000); // Wait for 1000ms (1 second)

    // Turn LED OFF
    led.write(PinLevel.Low);
    time.delay(1000);
}

led.close();
console.log("Finished!");
```

## Step 4: Run

Make sure your device is powered on and run:

```bash
bscript project run
```

You should see the LED turn on and off every second!
