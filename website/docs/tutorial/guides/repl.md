---
sidebar_label: REPL & Notebook
---

# Interactive Development (REPL & Notebook)

After your program runs on the device, you can send **more BlueScript code** without editing files and running `bscript project run` again.

The easiest way is the **Notebook**: a browser UI where you run code in cells. You can also use a **REPL** in the terminal (one line at a time).

## Which mode should I use?

| Mode | Command | When to use it |
| :--- | :--- | :--- |
| **Notebook** | `bscript project run --with-notebook` | You have a project and want to try code in cells (recommended) |
| **Project REPL** | `bscript project run --with-repl` | Same as above, but you prefer the terminal |
| **Global REPL** | `bscript repl -b esp32` or `bscript repl -b host` | No project yet—language syntax only (use `-d` to specify device name on ESP32) |
| **Normal run** | `bscript project run` | You are writing the full app in `index.bs` |

**Notebook vs REPL:** The Notebook supports multi-line cells (**Shift+Enter** to run) and shows output on the side. The REPL accepts **one line per Enter**.

Hardware libraries (e.g. GPIO) work in the Notebook and Project REPL only if you ran `bscript project install` in that project. The global REPL cannot use them.

---

## Try the Notebook

This walkthrough continues from [Blink LED](../get-started/blink-led.md) (GPIO package installed, LED wired).

### 1. Shorten `index.bs`

Keep the entry file small so the Notebook opens quickly. Setup belongs here; experiments go in cells.

```typescript title="src/index.bs"
import { GPIO, PinMode, PinLevel } from "gpio";

// CHANGE 2 TO 23 IF USING AN EXTERNAL LED
const led = new GPIO(2, PinMode.InputOutput);

console.log("LED ready.");
```

The `led` variable stays available in later cells.

### 2. Start the Notebook

```bash
bscript project run --with-notebook
```

The CLI runs `index.bs`, then opens the Notebook in your browser ([http://localhost:3000](http://localhost:3000)). **Leave the terminal open** until you are done.

![BlueScript Notebook](/img/interactive-shell.png)

### 3. Run cells

1. Type code in the bottom cell.
2. Press **Shift+Enter** (or the play button).
3. See `console.log` output on the right.

Example—run these as two separate cells:

```typescript
console.log("LED on");
led.write(PinLevel.High);
```

```typescript
console.log("LED off");
led.write(PinLevel.Low);
```

Compile errors appear under the cell. Press **`Ctrl+D`** in the terminal to exit.

---

## Other modes

### Project REPL

```bash
bscript project run --with-repl
```

After `index.bs` runs, type one line at the `>` prompt. Installed packages (e.g. `gpio`) can be imported here. Exit with **`Ctrl+D`**. Do not combine `--with-repl` and `--with-notebook`.

### Global REPL

```bash
bscript repl -b esp32
# or, without hardware:
bscript repl -b host
```

Use this for quick syntax checks without a project. **GPIO and other installed libraries are not available.** Exit with **`Ctrl+D`**.

:::note Host runtime
The host runtime must be set up first. See [Try Without Microcontroller](./try-without-microcontroller.md) for setup.
:::

:::note
A global Notebook (without a project) is planned for a future release.
:::

---

## Good to know

* **Device name:** Notebook and Project REPL connect using `deviceName` in `bsconfig.json`. Global REPL uses the `-d` flag instead. The name must match what was set during `bscript board flash-runtime`. See [bsconfig.json](../../reference/bsconfig.md#esp32-fields).
* Code on the device is **lost after a reboot**—run the command again to re-upload.
* Variables and functions from earlier cells or REPL lines **stay available** until you disconnect.
