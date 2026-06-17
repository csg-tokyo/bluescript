# Inline C

One of BlueScript's most powerful features is **Inline C**.
Because BlueScript compiles to native code on the host before transmission, you can embed standard C code directly within your TypeScript-like source files.

This allows you to:
*   Call native ESP-IDF APIs not yet wrapped by libraries (ESP32 only).
*   Optimize critical loops for maximum performance.
*   Port existing C drivers easily.

:::note Board support
Examples that use **ESP-IDF** APIs apply to **ESP32** projects only. Standard C (for example `math.h`) works on both ESP32 and host.
:::

## Basic Syntax

To write C code, use the **`code`** tagged template literal. The content inside the backticks is injected into the generated C source file during compilation.

For any C library function you use, **you must include the corresponding header file**, just like in standard C development.

```typescript
// Define includes at the top level
code`#include <math.h>`

function pow(x:float, y: float):float {
    let result:float;
    // Use a C function
    code`${result} = (float)pow(${x}, ${y})`;
    return result;
}

console.log(pow(2.0, 3.0));
```

## Variable Interpolation

The true power of Inline C is how it interacts with BlueScript variables.
You can use standard template literal syntax (`${variable}`) to pass BlueScript values into C code. The compiler automatically handles the type bridging.

### Reading Variables

```typescript
code`
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
`

function delay(ms:integer) {
    code`vTaskDelay(pdMS_TO_TICKS(${ms}));`;
}

console.log("Wait start...");
delay(500); // Wait 500ms
console.log("Wait end.");
```

### Writing to Variables

You can also assign values calculated in C back to BlueScript variables.

```typescript
code`#include "esp_timer.h"`

function getCurrentTime() {
    // 1. Prepare a variable to hold the result
    let currentTime: float = 0.0;
    // 2. Call the C API and assign the result
    code`${currentTime} = esp_timer_get_time() / 1000.0;`;
    // 3. Print using BlueScript
    return currentTime;
}

console.log(getCurrentTime());
```

## Global Includes & Definitions

If you place a `code` block at the top level of your file (outside of any class or function), it will be placed in the global scope of the generated C file.
This is used for `#include` directives or defining C global variables.

To include project-local `.c` or `.h` files, see [Imports & Includes](./imports-and-includes.md).

```typescript
// Global scope: Includes and Helper functions
code`
#include <math.h>
#define PI 3.14159265
`

export function getCircleArea(radius: float): float {
    let area = 0.0;
    code`${area} = PI * pow(${radius}, 2);`
    return area;
}

console.log(getCircleArea(4.0));
```

## Configuring Components

If you want to use specific ESP-IDF APIs (e.g., GPIO driver, NVS, WiFi), you must link the corresponding components.

Add component names to the `espIdfComponents` field in the project's [bsconfig.json](../../reference/bsconfig.md).

```json title="bsconfig.json"
{
  // ...
  "espIdfComponents": [
    "esp_driver_gpio",
  ]
}
```

Once configured, you can include the component's header and call its functions.

Here is an example of calling raw GPIO functions directly from the esp_driver_gpio component.

```typescript title="src/index.bs"

code`#include "driver/gpio.h"`

const LED_PIN: integer = 2;

function ledOn() {
    code`
    gpio_reset_pin(${LED_PIN});
    gpio_set_direction(${LED_PIN}, GPIO_MODE_OUTPUT);
    gpio_set_level(${LED_PIN}, 1);
    `
}

ledOn();

```

Note: Common libraries like newlib (math.h, string.h) are linked by default.


## Safety & Best Practices

With great power comes great responsibility. Since Inline C gives you raw access to the microcontroller, you must be careful.

:::danger No Syntax Checking
The BlueScript editor (and compiler phase 1) treats the string inside `code` as plain text. 
Syntax errors in your C code (like missing semicolons) will only be reported when the C compiler attempts to build the binary.
:::

### Type Compatibility
When passing variables:
*   **BlueScript `integer`** ↔ **C `int`**
*   **BlueScript `float`** ↔ **C `float`**
*   **BlueScript `boolean`** ↔ **C `int`** (0 or 1)

