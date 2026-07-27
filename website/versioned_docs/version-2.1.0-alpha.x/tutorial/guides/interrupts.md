# Handling Interrupts

In embedded systems, **Interrupts** allow the microcontroller to respond immediately to external events (like a button press or a sensor signal) without constantly checking the pin state (polling).

BlueScript provides two types of interrupts: **Soft Interrupts** and **Hard Interrupts**. Understanding the difference is crucial for writing stable applications.

## Soft Interrupts (Recommended)

**Soft Interrupts** are the safest and easiest way to handle events.

When the hardware triggers the interrupt, the BlueScript runtime simply flags an event. The actual execution of your callback function happens **on the Main Thread** after the current task finishes.

*   **Pros:** Safe. You can use **all** BlueScript features (console.log, memory allocation, string manipulation).
*   **Cons:** Higher latency (microseconds to milliseconds depending on CPU load).
*   **Use Case:** User input (buttons), low-frequency sensors, state changes.

### Example

```typescript
import { GPIO, PinMode, InterruptEdge, InterruptType } from "gpio";

const button = new GPIO(0, PinMode.Input);

// Use InterruptType.Soft
button.onChange(InterruptEdge.Falling, InterruptType.Soft, () => {
    // Memory allocation allowed
    let message: string = "Button was pressed!"; 
    
    // It is safe to do heavy operations here
    console.log(message);
});
```

## Hard Interrupts (Advanced)

**Hard Interrupts** execute the callback directly inside the hardware **ISR (Interrupt Service Routine)**. This interrupts the CPU immediately, pausing the main program.

*   **Pros:** Extremely low latency (nano-seconds).
*   **Cons:** **Strict limitations.** If you violate them, the device will crash (Panic/Guru Meditation).
*   **Use Case:** Counting high-frequency pulses (rotary encoders), critical timing signals.

### Restrictions
Inside a Hard Interrupt callback:
1.  ❌ **No Memory Allocation:** Do not create objects (`new`), arrays, or strings.
2.  ❌ **No Blocking:** Do not use `console.log` (it blocks for Bluetooth) or loops.
3.  ✅ **Integer Math Only:** Only basic math and accessing global `integer`, `float`, and `boolean` variables are safe.

### Example

To safely use Hard Interrupts, keep the logic minimal.

```typescript
import { GPIO, PinMode, PullMode, InterruptEdge, InterruptType } from "gpio";

const sensor = new GPIO(23, PinMode.Input);
let pulseCount: integer = 0; // Global counter

// Use InterruptType.Hard
sensor.onChange(InterruptEdge.Rising, InterruptType.Hard, () => {
    // ⚠️ CRITICAL: Keep this minimal!
    
    // Increment a counter (Safe integer operation)
    pulseCount = pulseCount + 1;
    
    // ❌ DO NOT write console.log here! It will crash the device.
});

// Main loop checks the counter
setInterval(() => {
    console.log("Pulses detected:", pulseCount);
}, 1000);
```

## Comparison

| Feature | Soft Interrupt | Hard Interrupt |
| :--- | :--- | :--- |
| **Execution Context** | Main Thread | Hardware ISR |
| **Latency** | Low (Dependent on main loop) | Ultra-Low (Immediate) |
| **Memory Allocation** | Allowed | **Forbidden** |
| **Console Output** | Allowed | **Forbidden** |
| **Safety** | High | Low (Risk of Crash) |

:::tip Which one should I use?
Start with **Soft Interrupts**. They are sufficient for 95% of use cases (buttons, presence sensors).
Only switch to **Hard Interrupts** if you are dealing with signals faster than 1kHz or need microsecond-precision timing.
:::
