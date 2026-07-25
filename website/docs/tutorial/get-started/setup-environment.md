import OsTabs from '@site/src/components/OsTabs';
import TabItem from '@theme/TabItem';

# Set up your environment

In this guide, we will install the BlueScript CLI and flash the runtime environment to your ESP32 microcontroller.

## Prerequisites

### Hardware

- **Host PC:** macOS or Windows
- **Microcontroller:** An ESP32 development board (e.g., ESP32-DevKitC)
- **USB cable** to connect your host PC and the microcontroller

### Software

<OsTabs>
<TabItem value="macos" label="macOS">

- [Node.js](https://nodejs.org/) v20 or later
- [Homebrew](https://brew.sh/)
- **Git** (`git`)
- **Python 3** (`python` or `python3`)
- **make** (`make`)

</TabItem>
<TabItem value="windows" label="Windows">

- [Node.js](https://nodejs.org/) v20 or later
- **Visual C++ Build Environment** (required for `npm install -g @bscript/cli`; see [Windows prerequisites](./setup-environment-windows.md#nodejs-and-visual-c-build-environment))
- **Git** (`git`)
- **Python 3** (`python` or `python3`)
- **make** or **mingw32-make**

For step-by-step installation instructions, see **[Windows prerequisites](./setup-environment-windows.md)**.

</TabItem>
<TabItem value="linux" label="Linux">

- [Node.js](https://nodejs.org/) v20 or later

</TabItem>
</OsTabs>

---

## Step 1: Install the CLI

BlueScript provides a command-line interface (CLI) to manage projects and communicate with your device.

<OsTabs>
<TabItem value="macos" label="macOS">

```bash
npm install -g @bscript/cli
```

</TabItem>
<TabItem value="windows" label="Windows">

Install the [Visual C++ Build Environment](./setup-environment-windows.md#nodejs-and-visual-c-build-environment) first, then:

```bash
npm install -g @bscript/cli
```

</TabItem>
<TabItem value="linux" label="Linux">

```bash
npm install -g @bscript/cli
```

</TabItem>
</OsTabs>

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

The CLI will display a list of detected serial ports. Use the arrow keys to select the one corresponding to your ESP32 (e.g., /dev/tty.usbserial-xxxx on macOS, COMX on Windows or /dev/ttyUSB0 on Linux).

:::info Device not found?
If your device does not appear in the list, you may need to install USB-to-UART drivers (e.g., [CP210x](https://www.silabs.com/software-and-tools/usb-to-uart-bridge-vcp-drivers) or [FTDI](https://ftdichip.com/drivers/vcp-drivers/)).

See also [Establish Serial Connection with ESP32](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/establish-serial-connection.html).
:::

If the flash is successful, your device is now ready to receive BlueScript code wirelessly!

:::note No microcontroller?
If you want to try BlueScript without hardware, see [Try Without Microcontroller](../guides/try-without-microcontroller.md).
:::
