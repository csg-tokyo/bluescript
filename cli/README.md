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
npm test
```

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

Before merging CLI changes or cutting a release, run the manual QA checklist:

**[docs/manual-test.md](./docs/manual-test.md)**

- **Daily PRs:** run the **Quick smoke (host)** section (~15 minutes).
- **Releases / ESP32 changes:** run the full checklist and ESP32 scenarios.

Automated unit tests in `tests/` cover command handlers with mocks. They do not replace end-to-end checks against a real host runtime, serial port, or Bluetooth device.
