# Quick Start

Let's get your first BlueScript program running. In this guide, we will set up your environment, flash the runtime to a microcontroller, and execute code wirelessly over Bluetooth.

Currently, only ESP32 development board is supported.

## Prerequisites

Before we begin, ensure you have the following:

*   **Hardware:** An ESP32 development board (e.g., ESP32-DevKitC) and a USB cable.
*   **Software:** [Node.js](https://nodejs.org/) (v18 or later) installed on your computer.

---

## Step 1: Install the CLI

BlueScript provides a command-line interface (CLI) to manage projects and communicate with your device. Install it globally using npm:

```bash
npm install -g @bluescript/cli
```

Verify the installation:

```bash
blue --version
```

---

## Step 2: Board Setup

Because BlueScript uses a **Disaggregated VM** architecture, you need to install the lightweight **Runtime** onto your microcontroller.

:::info One-Time Setup
The USB cable is only required for this step (`flash-runtime`). For daily development, you can use Bluetooth.
:::

1.  **Download the platform tools** for ESP32:

    ```bash
    blue board setup esp32
    ```
    Note: Currently, only esp32 is supported.

2.  **Connect your ESP32** to your computer via USB.
3.  **Flash the Runtime** to the device:

    ```bash
    blue board flash-runtime esp32
    ```

---

## Step 3: Create a Project

Create a new directory for your project. The CLI will generate the necessary configuration files.

```bash
blue create-project hello-bluescript
cd hello-bluescript
```

This creates a simple project structure:
*   `bsconfig.json`: Project configuration.
*   `index.bs`: Your entry point file.

---

## Step 4: Write Code

Open `index.bs` and write a simple program.

```typescript title="index.bs"
print("Hello world!");
```
---

## Step 5: Run Wirelessly

Make sure your ESP32 is powered on. You can disconnect the USB cable and power it via a battery if you wish.

Run the following command:

```bash
blue run
```

**What happens next?**
1. It scans for nearby BlueScript devices.
2. The CLI compiles your project into **Native Code** on your PC.
3. Upon selection, it transfers the binary via **Bluetooth**.
4. The ESP32 executes the code immediately.

:::tip Try the REPL
Want to test a command quickly without editing a file? Try the interactive mode!
Run blue repl in your terminal. You can type commands like print("Hello") or control GPIO pins directly, and see the results instantly.
:::

---

## Next Steps

Now that you have the basics down, explore what else BlueScript can do:

*   **[Language Reference](../../reference/language/intro)**: Learn about supported syntax, Inline C, and hardware APIs.
*   **[CLI Reference](../../reference/cli)**: Discover advanced commands.