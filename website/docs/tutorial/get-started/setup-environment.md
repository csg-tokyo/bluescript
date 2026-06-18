# Set up your environment

:::danger macOS Only
Currently, BlueScript strictly requires **macOS**. Windows and Linux support is under development.
:::

In this guide, we will install the BlueScript CLI and flash the runtime environment to your ESP32 microcontroller.

## Prerequisites

Before we begin, ensure you have the following:

- **Hardware:**
  - **Host PC:** A laptop running **macOS** (Windows and Linux are currently **not** supported).
  - **Micocontroller:** An ESP32 development board (e.g., ESP32-DevKitC)
  - **USB cable** to connect your host PC and the microcontroller 
- **Software:**
  - [Node.js](https://nodejs.org/) (v20 or later) installed on your host PC.
---

## Step 1: Install the CLI

BlueScript provides a command-line interface (CLI) to manage projects and communicate with your device. Install it globally using npm:

```bash
npm install -g @bscript/cli
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

### 2. Flash the Runtime

Connect your ESP32 to your computer via USB and flash the runtime:

```bash
bscript board flash-runtime esp32
```

The CLI will display a list of detected serial ports. Use the arrow keys to select the one corresponding to your ESP32 (e.g., /dev/tty.usbserial-xxxx).

:::info Device not found?
If your device does not appear in the list, you may need to install USB-to-UART drivers (e.g., [CP210x](https://www.silabs.com/software-and-tools/usb-to-uart-bridge-vcp-drivers) or [FTDI](https://ftdichip.com/drivers/vcp-drivers/)).

See also [Establish Serial Connection with ESP32](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/establish-serial-connection.html).
:::

If the flash is successful, your device is now ready to receive BlueScript code wirelessly!

:::note No microcontroller?
If you want to try BlueScript without hardware, see [Try Without Microcontroller](../guides/try-without-microcontroller.md).
:::
