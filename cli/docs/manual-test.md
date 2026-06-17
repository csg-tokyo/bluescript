# CLI Manual Test

Manual QA checklist for the BlueScript CLI (`bscript`).

For command syntax and option descriptions, see the [CLI Reference](../../website/docs/reference/cli.md). This document covers **how to verify** behavior, **expected results**, and **test environments**.

## When to run

- Before merging PRs that change `cli/src/**`
- Before publishing a new `@bscript/cli` release
- After changes to `@bscript/lang`, `@bscript/notebook`, or the runtime bundle consumed by the CLI

## Prerequisites

### Test target

Install the CLI version under test:

```bash
# From npm (release candidate)
npm install -g @bscript/cli@<version>

# From local checkout
cd cli && npm run build && npm link
```

Verify:

```bash
bscript -v
```

Use a clean working directory for project commands (no existing `bsconfig.json` in the current path unless the test requires it).

### Environment matrix

| Profile | OS | Node.js | Additional requirements |
| :--- | :--- | :--- | :--- |
| **host** | macOS | v18+ (v20+ recommended) | `cc`, `make` |
| **esp32** | macOS | v18+ (v20+ recommended) | ESP32 board, USB cable, Bluetooth enabled |

> **Note:** The host runtime currently requires **macOS**. ESP32 setup is also macOS-only in the current CLI implementation.

---

## Quick smoke (host only, ~15 min)

Run this before merging most CLI PRs. No hardware required.

1. **MT-SMOKE-01** — `bscript -v` prints the expected version
2. **MT-SMOKE-02** — `bscript board list` shows `esp32` and `host`
3. **MT-SMOKE-03** — `bscript board setup host` completes successfully (skip if already set up)
4. **MT-SMOKE-04** — `bscript project create smoke-host -b host` creates the project
5. **MT-SMOKE-05** — `cd smoke-host && bscript project check` succeeds
6. **MT-SMOKE-06** — `bscript project run` prints `Hello world!` and exits with Ctrl-D
7. **MT-SMOKE-07** — `bscript project run --with-repl` starts REPL after entry execution; one line runs; Ctrl-D exits

Cleanup (optional): remove `smoke-host/` and run `bscript board remove host -f` if you need a clean state.

---

## Full checklist

Each item has an ID for bug reports and test records. Record pass/fail in the [test record template](#test-record-template) below.

**Priority:** P0 = must pass for release · P1 = important · P2 = edge cases / nice to have

**Requires:** `host` · `esp32` · `both`

---

### Global

#### MT-GLOBAL-01: Version

- **Priority:** P0 · **Requires:** both
- **Steps:** Run `bscript -v` and `bscript --version`
- **Expected:** Both print the same version string matching the installed package

#### MT-GLOBAL-02: Top-level help

- **Priority:** P1 · **Requires:** both
- **Steps:** Run `bscript -h` and `bscript --help`
- **Expected:** Usage shows `board`, `project`, and `repl` subcommands

#### MT-GLOBAL-03: Unknown command

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript unknown`
- **Expected:** Non-zero exit with a clear error message

#### MT-GLOBAL-04: Subcommand help

- **Priority:** P1 · **Requires:** both
- **Steps:** Run `bscript board -h` and `bscript project -h`
- **Expected:** Lists subcommands for each group

---

### `bscript board list`

#### MT-BOARD-LIST-01: Initial state

- **Priority:** P1 · **Requires:** both
- **Precondition:** Fresh install or after `bscript board fullclean -f`
- **Steps:** Run `bscript board list`
- **Expected:** `esp32` and `host` listed as `not set up`; hint to run `bscript board setup` shown

#### MT-BOARD-LIST-02: After setup

- **Priority:** P1 · **Requires:** both
- **Precondition:** At least one board set up
- **Steps:** Run `bscript board list`
- **Expected:** Set-up boards show `set up` (green)

---

### `bscript board setup`

#### MT-BOARD-SETUP-01: Host setup

- **Priority:** P0 · **Requires:** host
- **Steps:**
  1. Run `bscript board setup host`
  2. Confirm the setup plan prompt
- **Expected:** Success message; next-step hint mentions `bscript project create <name> -b host`

#### MT-BOARD-SETUP-02: Host already set up

- **Priority:** P1 · **Requires:** host
- **Precondition:** Host already set up
- **Steps:** Run `bscript board setup host` again
- **Expected:** Warning that setup is already complete; no re-download

#### MT-BOARD-SETUP-03: Setup cancelled

- **Priority:** P2 · **Requires:** host
- **Steps:** Run `bscript board setup host` and answer **No** at the confirmation prompt
- **Expected:** `Setup cancelled by user.`; no partial state corruption

#### MT-BOARD-SETUP-04: ESP32 setup

- **Priority:** P0 · **Requires:** esp32
- **Steps:** Run `bscript board setup esp32` and confirm
- **Expected:** Success; next-step hint mentions `bscript board flash-runtime esp32`

#### MT-BOARD-SETUP-05: Unknown board

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript board setup unknown`
- **Expected:** `Unsupported board name` error; non-zero exit

---

### `bscript board flash-runtime`

#### MT-BOARD-FLASH-01: Not supported on host

- **Priority:** P1 · **Requires:** host
- **Steps:** Run `bscript board flash-runtime host`
- **Expected:** Error: `flash-runtime is not supported for the host board`

#### MT-BOARD-FLASH-02: ESP32 before setup

- **Priority:** P1 · **Requires:** esp32
- **Precondition:** ESP32 not set up
- **Steps:** Run `bscript board flash-runtime esp32`
- **Expected:** Warning to run `bscript board setup esp32` first

#### MT-BOARD-FLASH-03: Interactive port selection

- **Priority:** P0 · **Requires:** esp32
- **Precondition:** ESP32 set up; device connected via USB
- **Steps:** Run `bscript board flash-runtime esp32` (no `--port`)
- **Expected:** Serial port list appears; flash succeeds; success message with `bscript project run` hint

#### MT-BOARD-FLASH-04: Explicit port

- **Priority:** P1 · **Requires:** esp32
- **Steps:** Run `bscript board flash-runtime esp32 --port <port>`
- **Expected:** Port selection skipped; flash succeeds

#### MT-BOARD-FLASH-05: No serial ports

- **Priority:** P2 · **Requires:** esp32
- **Precondition:** No device connected
- **Steps:** Run `bscript board flash-runtime esp32`
- **Expected:** `No serial ports found` error

---

### `bscript board remove`

#### MT-BOARD-REMOVE-01: Nothing to remove

- **Priority:** P2 · **Requires:** both
- **Precondition:** Board not set up
- **Steps:** Run `bscript board remove host`
- **Expected:** Warning: not set up; nothing removed

#### MT-BOARD-REMOVE-02: Confirm and cancel

- **Priority:** P1 · **Requires:** host
- **Steps:** Run `bscript board remove host`; answer **No**
- **Expected:** `Removal process cancelled by user.`

#### MT-BOARD-REMOVE-03: Confirm removal

- **Priority:** P1 · **Requires:** host
- **Steps:** Run `bscript board remove host`; answer **Yes**
- **Expected:** Success; `bscript board list` shows `host` as `not set up`

#### MT-BOARD-REMOVE-04: Force flag

- **Priority:** P1 · **Requires:** host
- **Steps:** Run `bscript board remove host -f`
- **Expected:** No confirmation prompt; board removed

---

### `bscript board fullclean`

#### MT-BOARD-FULLCLEAN-01: Cancel

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript board fullclean`; answer **No**
- **Expected:** `Fullclean process cancelled by user.`

#### MT-BOARD-FULLCLEAN-02: Remove all settings

- **Priority:** P1 · **Requires:** both
- **Steps:** Run `bscript board fullclean`; answer **Yes**
- **Expected:** Success; all boards show `not set up` in `bscript board list`

#### MT-BOARD-FULLCLEAN-03: Force flag

- **Priority:** P1 · **Requires:** both
- **Steps:** Run `bscript board fullclean -f`
- **Expected:** No confirmation prompt; all settings removed

---

### `bscript board update`

#### MT-BOARD-UPDATE-01: Up to date

- **Priority:** P1 · **Requires:** both
- **Precondition:** Latest runtime and environments installed
- **Steps:** Run `bscript board update`
- **Expected:** Steps report `not needed` / skip where appropriate; no errors

#### MT-BOARD-UPDATE-02: After update, run still works

- **Priority:** P0 · **Requires:** host
- **Steps:** Run `bscript board update`, then `bscript project run` in a host project
- **Expected:** Project runs normally

---

### `bscript project create`

#### MT-PROJ-CREATE-01: Host project

- **Priority:** P0 · **Requires:** host
- **Steps:** Run `bscript project create test-host -b host`
- **Expected:** Directory created with:
  - `bsconfig.json` (`boardName: "host"`)
  - `src/index.bs` (Hello world sample)
  - `.gitignore`

#### MT-PROJ-CREATE-02: Interactive board selection

- **Priority:** P1 · **Requires:** both
- **Steps:** Run `bscript project create test-interactive` (no `--board`)
- **Expected:** Prompt to choose `esp32` or `host`; project created for selected board

#### MT-PROJ-CREATE-03: ESP32 project

- **Priority:** P0 · **Requires:** esp32
- **Steps:** Run `bscript project create test-esp32 -b esp32`
- **Expected:** `bsconfig.json` has `boardName: "esp32"`

#### MT-PROJ-CREATE-04: Directory already exists

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript project create test-host -b host` twice
- **Expected:** Second run fails with `already exists`

#### MT-PROJ-CREATE-05: Board not set up

- **Priority:** P1 · **Requires:** both
- **Precondition:** Target board not set up
- **Steps:** Run `bscript project create test -b host`
- **Expected:** Error: environment not set up

#### MT-PROJ-CREATE-06: Invalid board

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript project create test -b invalid`
- **Expected:** `Unsupported board name` error

---

### `bscript project check`

#### MT-PROJ-CHECK-01: Valid project

- **Priority:** P0 · **Requires:** both
- **Steps:** In a valid project, run `bscript project check`
- **Expected:** `Successfully checked BlueScript program.`; no device connection required

#### MT-PROJ-CHECK-02: Syntax error

- **Priority:** P1 · **Requires:** host
- **Steps:** Introduce a syntax error in `src/index.bs`; run `bscript project check`
- **Expected:** Compile error displayed; non-zero exit

#### MT-PROJ-CHECK-03: Inline C

- **Priority:** P1 · **Requires:** both
- **Steps:** Add Inline C (`code` tagged template) to the project; run `bscript project check`
- **Expected:** Check succeeds on host; on ESP32, ESP-IDF-specific C also builds if used

#### MT-PROJ-CHECK-04: Outside project directory

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript project check` where no `bsconfig.json` exists
- **Expected:** Clear error; non-zero exit

---

### `bscript project run`

#### MT-PROJ-RUN-01: Host normal run

- **Priority:** P0 · **Requires:** host
- **Steps:**
  1. `cd` into a host project
  2. Run `bscript project run`
- **Expected:** Steps Connecting → Initializing → Compiling → Loading → execution; `console.log` output visible; Ctrl-D exits cleanly

#### MT-PROJ-RUN-02: Host compile error

- **Priority:** P1 · **Requires:** host
- **Steps:** Run with invalid source
- **Expected:** `Failed to run BlueScript program.`; non-zero exit

#### MT-PROJ-RUN-03: ESP32 run

- **Priority:** P0 · **Requires:** esp32
- **Precondition:** Runtime flashed; device powered and in range
- **Steps:** Run `bscript project run` in an ESP32 project
- **Expected:** Bluetooth scan/connect; compile; transfer; execution succeeds

#### MT-PROJ-RUN-04: ESP32 disconnect

- **Priority:** P2 · **Requires:** esp32
- **Steps:** Disconnect Bluetooth or power off device during run
- **Expected:** `Disconnected.` message; non-zero exit

#### MT-PROJ-RUN-05: With REPL

- **Priority:** P0 · **Requires:** both
- **Steps:** Repeat in a **host** project and an **ESP32** project.
  1. Run `bscript project run --with-repl`
  2. Enter one valid line at the `>` prompt (e.g. `console.log("repl");`)
- **Expected:** Entry file runs first; then `>` REPL prompt; REPL line compiles and runs; compile errors shown without exiting REPL; Ctrl-D exits. On ESP32, Bluetooth connection succeeds before REPL starts.

#### MT-PROJ-RUN-06: With Notebook

- **Priority:** P1 · **Requires:** both
- **Steps:** Repeat in a **host** project and an **ESP32** project.
  1. Run `bscript project run --with-notebook`
  2. Run one cell in the browser UI
- **Expected:** Entry runs; browser opens `http://localhost:3000`; WebSocket at `ws://localhost:8080`; cell execution works; Ctrl-D in terminal exits. On ESP32, device connection succeeds before Notebook starts.

#### MT-PROJ-RUN-07: Conflicting options

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript project run --with-repl --with-notebook`
- **Expected:** Commander reports option conflict; command does not run

#### MT-PROJ-RUN-08: Built-in library

- **Priority:** P0 · **Requires:** both
- **Steps:** Repeat in a **host** project and an **ESP32** project. Set `src/index.bs` to use built-in APIs (no `import`):
  ```typescript
  console.log("built-in");
  print("via print");
  console.log(time.now());
  ```
  Run `bscript project run`.
  On **ESP32**, optionally add `time.delay(500);` before the last line and confirm it also works (ESP32-only API).
- **Expected:** All lines produce output; no compile or runtime error. See [Built-in Library](../../website/docs/reference/libraries/builtin.md).

#### MT-PROJ-RUN-09: User-defined functions and variables

- **Priority:** P0 · **Requires:** both
- **Steps:** Repeat in a **host** project and an **ESP32** project. Set `src/index.bs` to:
  ```typescript
  const message = "hello";
  function greet(): void {
      console.log(message);
  }
  greet();
  ```
  Run `bscript project run`.
- **Expected:** `hello` printed on both boards; function and variable bindings work at runtime.

#### MT-PROJ-RUN-10: Local module import

- **Priority:** P0 · **Requires:** both
- **Steps:** Repeat in a **host** project and an **ESP32** project.
  1. Create `src/math-utils.bs`:
     ```typescript
     export function add(a: integer, b: integer): integer {
         return a + b;
     }
     ```
  2. Set `src/index.bs` to:
     ```typescript
     import { add } from "./math-utils";
     console.log(add(10, 20));
     ```
  3. Run `bscript project run`.
- **Expected:** `30` printed on both boards; relative import resolves under `srcDir`.

#### MT-PROJ-RUN-11: Installed package

- **Priority:** P0 · **Requires:** esp32
- **Precondition:** GPIO package installed (`bscript project install https://github.com/bluescript-lang/pkg-gpio-esp32.git`)
- **Steps:** Set `src/index.bs` to:
  ```typescript
  import { GPIO, PinMode } from "gpio";
  const led = new GPIO(2, PinMode.InputOutput);
  console.log("GPIO ready");
  ```
  Run `bscript project run`.
- **Expected:** Compiles and runs without import/resolve errors; `GPIO ready` printed. See [Standard Libraries](../../website/docs/reference/libraries/standard.md).

#### MT-PROJ-RUN-12: Built-in library in project REPL

- **Priority:** P1 · **Requires:** both
- **Steps:** Repeat in a **host** project and an **ESP32** project.
  1. Set `src/index.bs` to `console.log("entry done");`
  2. Run `bscript project run --with-repl`
  3. At the `>` prompt, enter: `console.log(time.now());`
- **Expected:** Entry runs first; REPL line executes using built-in `console.log` and `time.now` without error on both boards.

#### MT-PROJ-RUN-13: Entry variables and functions in project REPL

- **Priority:** P1 · **Requires:** both
- **Steps:** Repeat in a **host** project and an **ESP32** project.
  1. Set `src/index.bs` to:
     ```typescript
     const msg = "from entry";
     function show(): void {
         console.log(msg);
     }
     console.log("entry done");
     ```
  2. Run `bscript project run --with-repl`
  3. At the `>` prompt, enter: `show();`
  4. Enter: `console.log(msg);`
- **Expected:** Both REPL lines succeed on both boards; `from entry` printed twice (once per line); entry-defined function and variable remain available in REPL.

#### MT-PROJ-RUN-14: Installed package in project REPL

- **Priority:** P1 · **Requires:** esp32
- **Precondition:** GPIO package installed; entry file sets up a `led` instance (see [REPL & Notebook tutorial](../../website/docs/tutorial/guides/repl.md))
- **Steps:**
  1. Run `bscript project run --with-repl`
  2. At the `>` prompt, enter a line that uses `led` (e.g. `console.log("LED ready in REPL");`)
- **Expected:** Entry-imported package symbols (e.g. `led`) are usable in REPL without re-importing.

---

### `bscript project install`

#### MT-PROJ-INSTALL-01: Install all (no dependencies)

- **Priority:** P1 · **Requires:** both
- **Steps:** In a project with empty `dependencies`, run `bscript project install`
- **Expected:** Completes without error

#### MT-PROJ-INSTALL-02: Add package by URL

- **Priority:** P0 · **Requires:** esp32
- **Steps:** Run `bscript project install <git-url>` for a valid BlueScript package
- **Expected:** Package under `packages/`; `bsconfig.json` updated

#### MT-PROJ-INSTALL-03: Install with tag

- **Priority:** P1 · **Requires:** esp32
- **Steps:** Run `bscript project install <git-url> --tag <tag>`
- **Expected:** Specified tag/branch checked out

#### MT-PROJ-INSTALL-04: Restore from bsconfig

- **Priority:** P1 · **Requires:** esp32
- **Precondition:** Project with dependencies in `bsconfig.json`
- **Steps:** Delete `packages/`; run `bscript project install`
- **Expected:** All dependencies restored

#### MT-PROJ-INSTALL-05: Invalid URL

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript project install https://invalid.example/repo.git`
- **Expected:** Download failure; non-zero exit

#### MT-PROJ-INSTALL-06: Run with installed package

- **Priority:** P0 · **Requires:** esp32
- **Steps:** After install, `import` the package in source; run `bscript project run`
- **Expected:** Compiles and runs with package symbols available

---

### `bscript project uninstall`

#### MT-PROJ-UNINSTALL-01: Remove package

- **Priority:** P1 · **Requires:** esp32
- **Precondition:** Package installed
- **Steps:** Run `bscript project uninstall <package-name>`
- **Expected:** `packages/<name>/` removed; entry removed from `bsconfig.json`

#### MT-PROJ-UNINSTALL-02: Unknown package

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript project uninstall nonexistent`
- **Expected:** Error: not listed in dependencies

---

### `bscript repl`

#### MT-REPL-01: Missing board option

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript repl` (no `-b`)
- **Expected:** Required option error

#### MT-REPL-02: Host global REPL

- **Priority:** P1 · **Requires:** host
- **Steps:** Run `bscript repl -b host`
- **Expected:** Connecting → REPL prompt; first line treated as entry; subsequent lines as fragments; Ctrl-D exits cleanly

#### MT-REPL-03: ESP32 global REPL

- **Priority:** P1 · **Requires:** esp32
- **Steps:** Run `bscript repl -b esp32` with device available
- **Expected:** Bluetooth connection; REPL works

#### MT-REPL-04: Compile error in REPL

- **Priority:** P2 · **Requires:** both
- **Steps:** Run `bscript repl -b host` and `bscript repl -b esp32`. Enter invalid syntax at the REPL prompt on each board.
- **Expected:** Compile error shown; REPL continues on both boards.

#### MT-REPL-05: No hardware libraries

- **Priority:** P1 · **Requires:** esp32
- **Steps:** Try importing a project-only package (e.g. GPIO) in global REPL
- **Expected:** Not available (project REPL / Notebook required for installed packages)

#### MT-REPL-06: Built-in library

- **Priority:** P0 · **Requires:** both
- **Steps:** Run `bscript repl -b host` and `bscript repl -b esp32`. At the `>` prompt on each board, enter lines that use built-in APIs (no `import`):
  1. `console.log("built-in");`
  2. `print("via print");`
  3. `console.log(time.now());`
  On **ESP32**, optionally enter `time.delay(500);` and confirm it works.
- **Expected:** Each line compiles and runs; output appears for all entries on both boards. See [Built-in Library](../../website/docs/reference/libraries/builtin.md).

#### MT-REPL-07: Variables persist across REPL lines

- **Priority:** P0 · **Requires:** both
- **Steps:** Run `bscript repl -b host` and `bscript repl -b esp32`. On each board:
  1. First line: `const x = 42; console.log("init");`
  2. Second line: `console.log(x);`
- **Expected:** First line prints `init`; second line prints `42` on both boards; variable defined on an earlier line remains in scope.

#### MT-REPL-08: User-defined functions persist across REPL lines

- **Priority:** P1 · **Requires:** both
- **Steps:** Run `bscript repl -b host` and `bscript repl -b esp32`. On each board:
  1. First line: `function double(n: integer): integer { return n * 2; } console.log("fn defined");`
  2. Second line: `console.log(double(21));`
- **Expected:** First line prints `fn defined`; second line prints `42` on both boards; function defined on an earlier line can be called later.

---

## End-to-end scenarios

### Scenario A: Host (no hardware)

1. `bscript board fullclean -f` *(optional clean start)*
2. `bscript board setup host`
3. `bscript board list` — host shows `set up`
4. `bscript project create hello-host -b host`
5. `cd hello-host`
6. Edit `src/index.bs` — add a `console.log` with a distinct message
7. `bscript project check`
8. `bscript project run` — verify output (MT-PROJ-RUN-08–10: built-in, functions/variables, local import)
9. `bscript project run --with-repl` — run REPL lines (MT-PROJ-RUN-12–13)
10. `bscript project run --with-notebook` — run a cell in the browser
11. `bscript repl -b host` — verify built-in and REPL state (MT-REPL-06–08)

### Scenario B: ESP32 (hardware required)

1. `bscript board setup esp32`
2. `bscript board flash-runtime esp32` *(select port or use `--port`)*
3. `bscript project create hello-esp32 -b esp32`
4. `cd hello-esp32`
5. `bscript project check`
6. `bscript project run` — verify Bluetooth connection and execution (MT-PROJ-RUN-08–10)
7. `bscript project run --with-repl` — verify REPL built-in and entry state (MT-PROJ-RUN-12–13)
8. `bscript repl -b esp32` — verify built-in and REPL state (MT-REPL-06–08)
9. `bscript project install <package-git-url>` *(e.g. GPIO library)*
10. Update source to use the package; `bscript project run` (MT-PROJ-RUN-11)
11. `bscript project run --with-notebook` — use package symbols in a cell (MT-PROJ-RUN-14)
12. `bscript project uninstall <package-name>`

### Scenario C: Board lifecycle

1. `bscript board setup host`
2. `bscript board remove host` — confirm **Yes**
3. `bscript board setup host` — re-setup succeeds
4. `bscript board fullclean -f`
5. `bscript board list` — all boards `not set up`

---

## Test record template

Copy and fill in one row per test session:

| Date | Tester | CLI version | OS | Scope | Result | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| YYYY-MM-DD | | | macOS … | Quick smoke (host) | PASS / FAIL | |

For failures, include the item ID (e.g. `MT-PROJ-RUN-03`) in Notes or link to an issue.

---

## Coverage map: automated vs manual

Jest tests in `cli/tests/` mock filesystem, network, and device I/O. Use this table to avoid re-testing mocked behavior manually while ensuring gaps are covered.

| Area | Jest coverage | Manual testing still needed |
| :--- | :--- | :--- |
| `board setup` | Handler logic, macOS paths, skip-if-done | Real download, ESP-IDF install, host runtime build |
| `board flash-runtime` | ESP32 handler, host rejection, port prompt mocked | Actual USB flash on hardware |
| `board remove` / `fullclean` | File removal, prompts mocked | Confirm disk state after real removal |
| `board update` | Update steps, rollback logic | End-to-end after real version bump |
| `board list` | — | Visual output, setup status labels |
| `project create` | File generation, validation | Interactive board picker |
| `project install` | Git clone mocked | Real Git URLs, tag checkout, board mismatch |
| `project uninstall` | — | Full uninstall flow |
| `project check` | — | Real compiler, Inline C |
| `project run` | — | Process output, built-in/local import/package usage, REPL state, Notebook UI, BLE |
| `repl` | — | Built-in library, variable/function persistence, interactive session, device connection |
| WebSocket / device protocol | Unit tests | Browser Notebook integration |
| Global help / version | — | Quick smoke items |

Run automated tests before manual QA:

```bash
cd cli && npm test
```
