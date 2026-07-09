---
slug: /tutorial/get-started/setup-environment-windows
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Windows prerequisites

This page walks you through installing the software BlueScript needs on **Windows**.

## Node.js and Visual C++ Build Environment {#nodejs-and-visual-c-build-environment}

`@bscript/cli` depends on native Node.js add-ons (for example `serialport` and Bluetooth libraries). On Windows, `npm install -g @bscript/cli` uses **node-gyp**, which compiles those add-ons and requires a **Visual C++ Build Environment** in addition to Node.js.

Install **both** before running `npm install -g @bscript/cli`.

### Node.js {#nodejs}

**What it is:** The JavaScript runtime that powers `npm` and the BlueScript CLI.

**Version:** v20 or later (LTS recommended).

<Tabs>
<TabItem value="nodejs-official" label="Official installer (recommended)">

1. Download the **LTS** installer from [nodejs.org](https://nodejs.org/).
2. Run the installer and accept the defaults. The option to **add Node.js to PATH** is enabled by default — leave it on.
3. Close any open terminals and open a **new** one.

</TabItem>
<TabItem value="nodejs-winget" label="winget">

If [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) is available:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then open a **new** terminal.

</TabItem>
<TabItem value="nodejs-choco" label="Chocolatey">

If [Chocolatey](https://chocolatey.org/install) is installed:

```powershell
choco install nodejs-lts -y
```

Then open a **new** terminal.

</TabItem>
</Tabs>

**Verify:**

```powershell
node --version
npm --version
```

You should see version numbers (for example `v22.x.x` and `10.x.x`), not "command not found".

### Visual C++ Build Environment {#visual-c-build-environment}

**What it is:** Microsoft’s C++ compiler and Windows SDK. **node-gyp** uses them to build native Node.js modules during `npm install`.

**You do not need to add anything to PATH manually** — the installer registers the build tools with Visual Studio’s locator, which node-gyp finds automatically.

<Tabs>
<TabItem value="vc-official" label="Official installer (recommended)">

1. Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (free).
2. Run the installer. On the **Workloads** tab, check **"Desktop development with C++"** (C++ によるデスクトップ開発).
3. Click **Install** and wait until it finishes (several GB; may take a while).
4. Open a **new** terminal.

You can use full **Visual Studio** (Community edition is fine) instead of Build Tools, with the same **"Desktop development with C++"** workload.

</TabItem>
<TabItem value="vc-choco" label="Chocolatey">

If Chocolatey is installed:

```powershell
choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" -y
```

Then open a **new** terminal.

</TabItem>
</Tabs>

**Verify:** There is no single `cl` command guaranteed on PATH in a normal terminal. The practical check is to install the CLI (after Node.js and the build tools are installed):

```powershell
npm install -g @bscript/cli
bscript --version
```

If `npm install` fails with `gyp ERR! find VS`, the C++ workload is missing or the terminal was opened before installation finished — reinstall the workload and use a **new** terminal.

---

## Git {#git}

**What it is:** Version control used by ESP-IDF setup to clone repositories.

**Required for:** `bscript board setup esp32` only.

<Tabs>
<TabItem value="git-official" label="Official installer (recommended)">

1. Download [Git for Windows](https://git-scm.com/download/win).
2. Run the installer. When asked about **Adjusting your PATH environment**, choose **"Git from the command line and also from 3rd-party software"** so `git` works in PowerShell and Command Prompt.
3. Other options can stay at defaults. Open a **new** terminal after installation.

</TabItem>
<TabItem value="git-winget" label="winget">

```powershell
winget install Git.Git
```

Open a **new** terminal. If `git` is not found, re-run the official installer and ensure PATH integration is enabled.

</TabItem>
<TabItem value="git-choco" label="Chocolatey">

```powershell
choco install git -y
```

Open a **new** terminal.

</TabItem>
</Tabs>

**Verify:**

```powershell
git --version
```

---

## Python 3 {#python-3}

**What it is:** A programming language runtime. ESP-IDF’s Windows installer (`install.bat`) uses Python to set up its own tool environment.

**Required for:** `bscript board setup esp32` (install **before** that command).

**Version:** 3.8 or later; 3.11+ recommended.

<Tabs>
<TabItem value="python-official" label="Official installer (recommended)">

1. Download Python from [python.org/downloads/windows](https://www.python.org/downloads/windows/).
2. Run the installer. At the bottom of the first screen, enable **"Add python.exe to PATH"** — this is important.
3. Choose **Install Now** (or **Customize** if you prefer). Open a **new** terminal after installation.

</TabItem>
<TabItem value="python-winget" label="winget">

```powershell
winget install Python.Python.3.12
```

Open a **new** terminal.

</TabItem>
<TabItem value="python-choco" label="Chocolatey">

```powershell
choco install python -y
```

Open a **new** terminal.

</TabItem>
</Tabs>

**Verify:**

```powershell
python --version
```

If `python` is not found, try:

```powershell
python3 --version
```

BlueScript accepts either `python` or `python3` on PATH.

---

## MinGW-w64 {#mingw-w64}

**What it is:** A GCC-based C/C++ toolchain for Windows (`gcc`, `ar`, and often `mingw32-make`).

**Required for:** [Host runtime](../guides/try-without-microcontroller.md) — `bscript board setup host` compiles native code with **MinGW’s** `gcc` and `mingw32-make`, not Visual Studio’s compiler.

:::info Visual C++ vs MinGW
- **Visual C++ Build Environment** → needed for `npm install` (Node native modules).
- **MinGW-w64** → needed for `bscript board setup host` (BlueScript host runtime).

They serve different purposes; host development on Windows needs **both**.
:::

<Tabs>
<TabItem value="mingw-msys2" label="MSYS2 (recommended)">

[MSYS2](https://www.msys2.org/) provides a maintained MinGW-w64 environment.

1. Download and run the MSYS2 installer from [msys2.org](https://www.msys2.org/).
2. Open **MSYS2 UCRT64** from the Start menu (not the plain "MSYS" shell).
3. Update the package database (first time only):

```bash
pacman -Syu
```

Close the window when prompted, reopen **MSYS2 UCRT64**, and run `pacman -Syu` again if needed.

4. Install the toolchain and make:

```bash
pacman -S --needed mingw-w64-ucrt-x86_64-toolchain mingw-w64-ucrt-x86_64-make
```

5. Add MinGW to your **Windows** PATH (not only inside MSYS2):

   - Typical folder: `C:\msys64\ucrt64\bin` (adjust if you installed MSYS2 elsewhere).
   - **Settings → System → About → Advanced system settings → Environment Variables**
   - Under **User variables** or **System variables**, edit **Path**, click **New**, paste the `ucrt64\bin` path, and confirm.

6. Open a **new** PowerShell or Command Prompt window.

</TabItem>
<TabItem value="mingw-choco" label="Chocolatey">

```powershell
choco install mingw -y
```

Chocolatey usually adds MinGW’s `bin` folder to PATH. Open a **new** terminal.

If `gcc -dumpmachine` does not contain `mingw`, use the MSYS2 method instead.

</TabItem>
</Tabs>

**Verify** (in PowerShell or Command Prompt, not only inside MSYS2):

```powershell
gcc --version
ar --version
mingw32-make --version
```

For host setup, `gcc` must be MinGW (not another vendor). Check with:

```powershell
gcc -dumpmachine
```

The output should include `mingw` (for example `x86_64-w64-mingw32`).

---

## make or mingw32-make {#make-or-mingw32-make}

**What it is:** A build automation tool. ESP-IDF uses `make` or `mingw32-make` when compiling firmware.

**Required for:** `bscript board setup esp32` and related ESP32 builds.

:::tip Already installed?
If you followed [MinGW-w64](#mingw-w64) via MSYS2 with `mingw-w64-ucrt-x86_64-make`, **`mingw32-make` is already available** — run the verify commands below and skip a separate make install unless `make` is also required by your workflow.
:::

BlueScript accepts **either** `make` **or** `mingw32-make` on PATH for ESP32.

<Tabs>
<TabItem value="make-msys2" label="MSYS2 (if not done above)">

In **MSYS2 UCRT64**:

```bash
pacman -S make
```

Or for `mingw32-make` only:

```bash
pacman -S mingw-w64-ucrt-x86_64-make
```

Add `C:\msys64\ucrt64\bin` (and optionally `C:\msys64\usr\bin` if you installed `make` from the `make` package) to Windows PATH. Open a **new** terminal.

</TabItem>
<TabItem value="make-choco" label="Chocolatey">

Install GNU make:

```powershell
choco install make -y
```

Open a **new** terminal.

</TabItem>
</Tabs>

**Verify:**

```powershell
make --version
```

If `make` is not found:

```powershell
mingw32-make --version
```

At least one of these must succeed before `bscript board setup esp32`.

---

## USB-to-UART drivers {#usb-to-uart-drivers}

**When you need this:** Your ESP32 does not show up as a COM port when you run `bscript board flash-runtime esp32`.

Many ESP32 boards use a USB–serial bridge chip. Windows needs a driver before the port appears in Device Manager.

1. Identify the chip on your board (common types: **CP2102**, **CH340**, **FT232**).
2. Install the matching driver:
   - [CP210x (Silicon Labs)](https://www.silabs.com/software-and-tools/usb-to-uart-bridge-vcp-drivers)
   - [FTDI VCP](https://ftdichip.com/drivers/vcp-drivers/)
   - CH340: search for "CH340 driver Windows" from your board vendor or [WCH](http://www.wch-ic.com/downloads/CH341SER_EXE.html)
3. Connect the board via USB. Open **Device Manager** (Win + X → Device Manager).
4. Under **Ports (COM & LPT)**, you should see something like **USB Serial Port (COM3)**. Note the COM number — the CLI lists it when flashing.

If the port still does not appear, try another USB cable (some cables are charge-only) or a different USB port.

See also [Establish Serial Connection with ESP32](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/establish-serial-connection.html) in the ESP-IDF documentation.

---

## Troubleshooting

| Problem | What to try |
| :--- | :--- |
| `'node' is not recognized` | Reinstall Node.js with PATH enabled; open a new terminal |
| `gyp ERR! find VS` during `npm install` | Install **Desktop development with C++** workload; new terminal |
| `'python' is not recognized` | Reinstall Python with **Add to PATH**; try `python3` |
| `'gcc' is not recognized` | Add MSYS2 `ucrt64\bin` to PATH; new terminal |
| `gcc` found but host setup fails | Run `gcc -dumpmachine` — must show `mingw`, not `msvc` |
| `'make' is not recognized` | Install `make` or ensure `mingw32-make` is on PATH |
| ESP32 COM port missing | Install USB-to-UART driver; check cable and Device Manager |

---
