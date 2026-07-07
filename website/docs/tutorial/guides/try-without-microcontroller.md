---
sidebar_label: Try Without Microcontroller
---

import OsTabs from '@site/src/components/OsTabs';
import TabItem from '@theme/TabItem';

# Try Without Microcontroller

BlueScript is designed primarily for microcontroller development (ESP32).
If you do not have hardware yet—or want a faster path for language and compiler checks—you can run BlueScript on the **host runtime** on your development machine.

For the main ESP32 workflow, see [Get Started](../get-started/introduction.md).

:::danger Linux not supported
The host runtime supports **macOS** and **Windows**. **Linux is not supported** at this time.
:::

## Prerequisites

<OsTabs>
<TabItem value="macos" label="macOS">

- [Node.js](https://nodejs.org/) v20+
- C compiler toolchain: **Xcode Command Line Tools** (`cc` and `make`)
- **Git** (`git`)

Install Command Line Tools if needed:

```bash
xcode-select --install
```

</TabItem>
<TabItem value="windows" label="Windows">

- [Node.js](https://nodejs.org/) v20+
- **Visual C++ Build Environment** (for `npm install -g @bscript/cli`; see [Windows prerequisites for ESP32](../get-started/setup-environment-windows.md#nodejs-and-visual-c-build-environment))
- [MinGW-w64](https://www.mingw-w64.org/) on `PATH`: `gcc` and `mingw32-make`
- **Git** (`git`)

</TabItem>
</OsTabs>

## Quickstart

### 1. Install the CLI

If you have not installed the CLI yet:

```bash
npm install -g @bscript/cli
```

On Windows, install the [Visual C++ Build Environment](../get-started/setup-environment-windows.md#nodejs-and-visual-c-build-environment) before running this command.

### 2. Set up the host runtime

```bash
bscript board setup host
```

### 3. Create a host project

```bash
bscript project create hello-host -b host
cd hello-host
```

### 4. Write your program

Edit `src/index.bs`:

```typescript title="src/index.bs"
console.log("Hello from host runtime!");
```

### 5. Run

```bash
bscript project run
```

You can also start interactive mode:

```bash
bscript project run --with-repl
# or
bscript project run --with-notebook
```

## Notes

- `bscript board flash-runtime` is for microcontrollers and is not supported for `host`.
- GPIO and other ESP32-specific libraries are not available on host.

## Host vs ESP32

| Topic | Host (`-b host`) | ESP32 (`-b esp32`) |
| :--- | :--- | :--- |
| Main use case | Fast local testing | Real hardware development |
| Runtime location | Local process on the development machine | Runtime on the microcontroller |
| Setup | `bscript board setup host` | `bscript board setup esp32` + `bscript board flash-runtime esp32` |
| Connection during run | Local process | Bluetooth |
| `deviceName` in bsconfig | Not available (field does not exist) | Available — BLE device name to connect to |
| Hardware libraries (GPIO, PWM, I2C) | Not available | Available via packages |
| `flash-runtime` | Not supported | Required for first-time setup |

Choose **ESP32** if you are building applications for real devices.
Choose **host** if you want a no-hardware path for syntax checks, compiler behavior checks, or CI-like validation.
