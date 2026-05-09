# Standard Libraries

BlueScript follows a "Battery-included but removable" philosophy.
Core features are kept minimal, while hardware drivers are provided as external standard libraries hosted on GitHub.

To install any of these libraries, use the command:
`bscript project install <git-url>`

## Available Libraries

Currently, the following libraries are available for stable use.

### Digital I/O
*   **GPIO (General Purpose Input/Output)**
    *   Control pins, read digital states, and handle interrupts.
    *   **Repository:** [https://github.com/bluescript-lang/pkg-gpio-esp32.git](https://github.com/bluescript-lang/pkg-gpio-esp32.git)
    *   **Usage:** `import { GPIO } from "gpio";`

### Control
*   **PWM (Pulse Width Modulation)**
    *   Pulse Width Modulation for LEDs and Servos.
    *   **Repository:** [https://github.com/bluescript-lang/pkg-pwm-esp32.git](https://github.com/bluescript-lang/pkg-pwm-esp32.git)
    *   **Usage:** `import { PWM } from "pwm";`

### Communication
*   **I2C (Inter-Integrated Circuit)**
    *   Interface with sensors and displays (Two-wire master library).
    *   **Repository:** [https://github.com/bluescript-lang/pkg-i2c-esp32.git](https://github.com/bluescript-lang/pkg-i2c-esp32.git)
    *   **Usage:** `import { I2CMasterBus, I2CDevice } from "i2c";`

---

## Roadmap (Planned Libraries)

We are actively developing drivers for the following peripherals.
Support for these features will be rolled out in upcoming updates.

| Category | Library | Status | Description |
| :--- | :--- | :--- | :--- |
| **Analog** | **ADC** | 🚧 Planned | Read analog sensor values. |
| **Analog** | **DAC** | 🚧 Planned | Output analog voltage signals. |
| **Comms** | **UART** | 🚧 Planned | Serial communication with other devices. |
| **Comms** | **SPI** | 🚧 Planned | High-speed serial communication. |
| **Audio** | **I2S** | 🚧 Planned | Digital audio data transfer. |
| **Wireless** | **WiFi** | 🚧 Planned | Connect to the internet, make HTTP requests. |
| **Wireless** | **Bluetooth** | 🚧 Planned | BLE communication (Central/Peripheral). |

<!-- :::note Contribute?
BlueScript is an open ecosystem. If you have wrapped an ESP-IDF component into a BlueScript package, feel free to share it with the community!
::: -->
