# Set up your environment

In this guide, we will install the BlueScript CLI and flash the runtime environment to your microcontroller.

Currently, only **ESP32 development boards** are supported.

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
bscript --version
```

---

## Step 2: Board Setup

Because BlueScript uses a **Disaggregated VM** architecture, you need to install the lightweight **Runtime** onto your microcontroller.

:::info One-Time Setup
The USB cable is only required for this step (`flash-runtime`). Once this is done, you can disconnect the cable and use Bluetooth for daily development.
:::

### 1. Download Platform Tools

Download the necessary environment files for the ESP32 platform:

```bash
bscript board setup esp32
```
*Note: Currently, only `esp32` is supported.*

### 2. Flash the Runtime

Connect your ESP32 to your computer via USB and flash the runtime:

```bash
bscript board flash-runtime esp32
```

If the flash is successful, your device is now ready to receive BlueScript code wirelessly!

---

## Next Steps

Now that your device is set up, let's create your first project.

👉 **[Go to: Create project and Run](./create-project-and-run)**
