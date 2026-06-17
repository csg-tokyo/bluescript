# @bscript/cli

The BlueScript CLI (`bscript`) is the primary tool for managing projects, setting up board environments, and running code on devices.

For end-user documentation, see the [CLI Reference](https://csg-tokyo.github.io/bluescript/docs/reference/cli) on the project website.

## Development

From the repository root:

```bash
npm install
```

Build and test the CLI package:

```bash
cd cli
npm run build
npm test                 # unit tests only
npm run test:integration # host integration tests (macOS + cc)
npm run test:all         # unit + integration
```

### Test layout

| Script | Jest project | Location | Notes |
| :--- | :--- | :--- | :--- |
| `npm test` | `unit` | `tests/**/*.test.ts` (excludes `integration/`) | Mocks fs, shell, logger, devices |
| `npm run test:integration` | `integration` | `tests/integration/**/*.test.ts` | Real host `shell` process; macOS only |
| `npm run test:all` | both | — | Run before merging CLI changes |

**Integration test requirements:** macOS, `cc`, and the `microcontroller/` tree at the repository root. On first run, tests build `microcontroller/ports/host/build/shell` and `c-runtime.so` if missing. Tests are skipped automatically on non-macOS platforms.

**Integration coverage (14 tests):**

- `tests/integration/project/run.host.test.ts` — `project run` on host: normal output, built-in library, functions/variables, local import, local package import, inline C, `.c` / `.h` includes, compile error
- `tests/integration/project/repl.host.test.ts` — `repl -b host`: entry line, built-in calls, variable/function persistence, compile-error recovery

CLI step logs are suppressed during integration runs (`tests/integration-setup.ts`). Program output from BlueScript code is still asserted via captured stdout.

Integration tests do **not** replace manual checks for ESP32 hardware, serial/BLE, Notebook UI, Git-based `project install`, or interactive TTY behavior (Ctrl-D, prompts). See **[docs/manual-test.md](./docs/manual-test.md)** for the manual QA checklist and coverage map.

Run the CLI from source without a global install:

```bash
npm start -- <subcommand> [options]
# Example:
npm start -- board list
```

Install locally for manual testing:

```bash
npm run build
npm link
bscript -v
```

## Manual testing

Before merging CLI changes or cutting a release:

1. Run `npm run test:all` (or at least `npm test`; on macOS also `npm run test:integration`).
2. Follow the manual QA checklist: **[docs/manual-test.md](./docs/manual-test.md)**

- **Daily PRs:** run automated tests plus **Quick smoke (host)** (~15 minutes).
- **Releases / ESP32 changes:** run the full checklist and ESP32 scenarios.
