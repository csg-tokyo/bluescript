# CLI

The BlueScript CLI (`bscript`) is the primary tool for managing projects, setting up board environments, and running code on your devices.

## Installation

```bash
npm install -g @bscript/cli
```

## Project Management

### `bscript project create`

Creates a new BlueScript project with the necessary configuration files.

```bash
bscript project create <project-name> [options]
```

This command generates a new directory containing:
*   `src/index.bs`: The main entry point for your application.
*   `bsconfig.json`: The project configuration file. See [bsconfig.json](./bsconfig.md) for all fields.

**Arguments:**
*   `<project-name>`: The name of the directory to create.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--board` | `-b` | Specify the target board (`esp32` or `host`). If omitted, an interactive selection list will appear. |

**Example:**
```bash
# Create a project interactively
bscript project create my-app

# Create a project specifically for ESP32
bscript project create my-app --board esp32

# Create a project for the host runtime (no hardware)
bscript project create my-app --board host
```

---

### `bscript project install`

Installs project dependencies. This command has two modes:

1. **Install All:** If run without arguments, it installs all dependencies listed in `bsconfig.json`.
2. **Add Package:** If a Git URL is provided, it downloads the package, adds it to `bsconfig.json`, and installs it.

See [bsconfig.json](./bsconfig.md#dependencies) for the `dependencies` field format.

```bash
bscript project install [git-url] [options]
```

**Arguments:**
*   `[git-url]`: (Optional) The URL of the Git repository to add as a dependency.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--tag` | `-t` | Specify a git tag or branch to checkout (e.g., `v1.0.0`, `main`). |

**Example:**
```bash
# Restore all dependencies from bsconfig.json
bscript project install

# Install a specific library (e.g., GPIO library)
bscript project install https://github.com/bluescript/gpio.git

# Install a specific version of a library
bscript project install https://github.com/bluescript/drivers.git --tag v2.0.0
```

---

### `bscript project uninstall`

Uninstall the specified package from the current project.

```bash
bscript project uninstall <package-name>
```

**Arguments:**
*   `<package-name>`: The package name to uninstall.

---

### `bscript project check`

Checks if the current project can be compiled successfully without actually sending it to a device.

```bash
bscript project check
```

This command runs the compiler locally on your host machine to verify for syntax errors and ensures that both BlueScript and Inline C code can be built correctly. You can use it to catch errors early before attempting to run the code on the hardware.

---

### `bscript project run`

Compiles the current project and executes it on the target board.

```bash
bscript project run [options]
```

When you run this command on an **ESP32** project:
1.  The CLI scans for a BlueScript device over Bluetooth whose name matches `deviceName` in `bsconfig.json` (default: `"BLUESCRIPT"`).
2.  The project is compiled into native code on your host machine.
3.  The code is transferred to the connected device and executed immediately.

The `deviceName` value must match the name set when you ran `bscript board flash-runtime`. See [bsconfig.json](./bsconfig.md#esp32-fields).

When you run this command on a **host** project, the CLI compiles the project and runs it in a local runtime process on your development machine. No Bluetooth connection is required.

**Options:**

| Option | Description |
| :--- | :--- |
| `--with-repl` | After the entry file (`entryFile` in `bsconfig.json`) finishes, start a terminal REPL on the device. Cannot be combined with `--with-notebook`. |
| `--with-notebook` | After the entry file finishes, start the browser Notebook UI (default HTTP port `3000`). Cannot be combined with `--with-repl`. |

See the [REPL & Notebook tutorial](../tutorial/guides/repl.md) for usage details.

---


## Board Management

These commands manage the toolchains and runtime environments for specific hardware platforms.

### `bscript board setup`

Downloads and installs the necessary environment files and dependencies for a specific board architecture.

```bash
bscript board setup <board-name>
```

**Arguments:**
*   `<board-name>`: The target board identifier (`esp32` or `host`).

For `esp32`, this downloads ESP-IDF and related tools. For `host`, this builds the local runtime process and requires a C compiler toolchain (`cc` and `make`). See [Try Without Microcontroller](../tutorial/guides/try-without-microcontroller.md).

---

### `bscript board flash-runtime`

Flashes the BlueScript Runtime firmware onto the microcontroller.
**Note:** This command requires a physical USB connection to the device. It is **not supported** for `host`.

```bash
bscript board flash-runtime <board-name> [options]
```

**Arguments:**
*   `<board-name>`: The target board identifier (e.g., `esp32`).

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--port` | `-p` | Specify the serial port connected to the device (e.g., `COM3`, `/dev/ttyUSB0`). If omitted, the CLI will list available ports for selection. |
| `--device-name` | `-d` | Bluetooth device name advertised by the runtime after flashing (default: `"BLUESCRIPT"`). Must match `deviceName` in your project's `bsconfig.json` when connecting wirelessly. |

**Example:**
```bash
bscript board flash-runtime esp32 --port /dev/ttyUSB0

# Flash with a custom Bluetooth device name
bscript board flash-runtime esp32 -d my-device
```

---

### `bscript board list`

Lists all board architectures currently supported by the installed CLI version (`esp32` and `host`).

```bash
bscript board list
```

---

### `bscript board remove`

Removes the environment files and setup data for a specific board.

```bash
bscript board remove <board-name> [options]
```

By default, this command asks for confirmation before deleting files.

**Arguments:**
*   `<board-name>`: The target board identifier (`esp32` or `host`).

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--force` | `-f` | Skips the confirmation prompt and forces removal. |

---

### `bscript board fullclean`

Completely removes all configuration and environment files for **all** boards. This returns the CLI board configurations to a fresh state.

```bash
bscript board fullclean
```
By default, this command asks for confirmation before deleting files.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--force` | `-f` | Skips the confirmation prompt and forces removal. |

---

### `bscript board update`

Update the version of installed environments.

```bash
bscript board update
```

---

## Other Commands

### `bscript repl`

Starts a **global** REPL session with the target device (no project required).

```bash
bscript repl --board <board-name> [options]
```

This mode is for language syntax experiments only. Hardware libraries installed via `bscript project install` are not available. For GPIO and other drivers, use `bscript project run --with-repl` or `--with-notebook` instead. See the [REPL & Notebook tutorial](../tutorial/guides/repl.md).

**Example:**
```bash
# Connect to the default device name
bscript repl -b esp32

# Connect to a custom device name
bscript repl -b esp32 -d my-device
```


**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--board` | `-b` | Specify the target board (`esp32` or `host`). |
| `--device-name` | `-d` | Bluetooth device name to connect to (default: `"BLUESCRIPT"`). **ESP32 only** — must match the name set during `bscript board flash-runtime`. Ignored for `host`. |
