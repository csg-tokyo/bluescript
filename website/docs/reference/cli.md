# CLI

The BlueScript CLI (`blue`) is the primary tool for managing projects, setting up board environments, and running code on your devices.

## Installation

```bash
npm install -g @bluescript/cli
```

## Project Commands

### `blue create-project`

Creates a new BlueScript project with the necessary configuration files.

```bash
blue create-project <project-name> [options]
```

This command generates a new directory containing:
*   `index.bs`: The main entry point for your application.
*   `bsconfig.json`: The project configuration file.

**Arguments:**
*   `<project-name>`: The name of the directory to create.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--board` | `-b` | Specify the target board (e.g., `esp32`). If omitted, an interactive selection list will appear. |

**Example:**
```bash
# Create a project interactively
blue create-project my-app

# Create a project specifically for ESP32
blue create-project my-app --board esp32
```

---

### `blue install`

Installs project dependencies. This command has two modes:

1. **Install All:** If run without arguments, it installs all dependencies listed in bsconfig.json.
2. **Add Package:** If a Git URL is provided, it downloads the package, adds it to bsconfig.json, and installs it.

```bash
blue install [git-url] [options]
```

**Arguments:**
*   `<git-url>`: (Optional) The URL of the Git repository to add as a dependency.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--tag` | `-t` | Specify a git tag or branch to checkout (e.g., `v1.0.0`, `main`). |

**Example:**
```bash
# Restore all dependencies from bsconfig.json
blue install

# Install a specific library (e.g., GPIO library)
blue install https://github.com/bluescript/gpio.git

# Install a specific version of a library
blue install https://github.com/bluescript/drivers.git --tag v2.0.0
```

---

### `blue run`

Compiles the current project and executes it on a target device via Bluetooth.

```bash
blue run
```

When you run this command:
1.  The CLI scans for available BlueScript devices over Bluetooth.
2.  The project is compiled into native code on your host machine.
3.  The code is transferred and executed immediately.

---

### `blue repl`

Starts an interactive Read-Eval-Print Loop (REPL) session with the target device.

```bash
blue repl --board <board-name>
```

Unlike `blue run` which compiles and sends the entire project, `blue repl` utilizes the incremental compiler and shadow machine. It allows you to write code line-by-line, compiling only the differences and sending them to the device instantly via Bluetooth.


**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--board` | `-b` | Specify the target board (e.g., `esp32`). |

---

## Board Management

These commands manage the toolchains and runtime environments for specific hardware platforms.

### `blue board setup`

Downloads and installs the necessary environment files and dependencies for a specific board architecture.

```bash
blue board setup <board-name>
```

**Arguments:**
*   `<board-name>`: The target board identifier (e.g., `esp32`).

---

### `blue board flash-runtime`

Flashes the BlueScript Runtime firmware onto the microcontroller.
**Note:** This command requires a physical USB connection to the device.

```bash
blue board flash-runtime <board-name> [options]
```

**Arguments:**
*   `<board-name>`: The target board identifier.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--port` | `-p` | Specify the serial port connected to the device (e.g., `COM3`, `/dev/ttyUSB0`). If omitted, the CLI will list available ports for selection. |

**Example:**
```bash
blue board flash-runtime esp32 --port /dev/ttyUSB0
```

---

### `blue board list`

Lists all board architectures currently supported by the installed CLI version.

```bash
blue board list
```

---

### `blue board remove`

Removes the environment files and setup data for a specific board.

```bash
blue board remove <board-name> [options]
```

By default, this command asks for confirmation before deleting files.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--force` | `-f` | Skips the confirmation prompt and forces removal. |

---

### `blue board fullclean`

Completely removes all configuration and environment files for **all** boards. This returns the CLI board configurations to a fresh state.

```bash
blue board fullclean
```
By default, this command asks for confirmation before deleting files.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--force` | `-f` | Skips the confirmation prompt and forces removal. |