# bsconfig.json

Every BlueScript project has a `bsconfig.json` file at the project root. The CLI reads this file when compiling, installing packages, and running code on a device.

`bscript project create` generates the file automatically. You can also edit it by hand.

## Example

```json title="bsconfig.json"
{
  "projectName": "hello-bluescript",
  "boardName": "esp32",
  "version": "1.0.0",
  "vmVersion": "2.0.0",
  "srcDir": "./src",
  "entryFile": "./src/index.bs",
  "deviceName": "BLUESCRIPT",
  "dependencies": {},
  "espIdfComponents": []
}
```

## Common fields

These fields are shared across all supported boards.

| Field | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `projectName` | Yes | — | Project name. Also used as the main package name during compilation. |
| `boardName` | Yes | — | Target board. Supported: `esp32`, `host`. |
| `version` | No | `"1.0.0"` | Project version string. |
| `vmVersion` | No | CLI version | BlueScript runtime version this project targets. |
| `srcDir` | No | `"."` | Directory containing BlueScript (`.bs`) and C (`.c`) source files, relative to the project root. |
| `entryFile` | No | `"./index.bs"` | Entry BlueScript file executed by `bscript project run`, relative to the project root. |
| `deviceName` | No | `"BLUESCRIPT"` | Bluetooth device name used when scanning for hardware. **ESP32 only** — ignored for `host` projects. |
| `dependencies` | No | `{}` | Installed package dependencies. Usually managed by `bscript project install`. |

### `srcDir` and `entryFile`

`srcDir` defines where the compiler looks for source files. Both BlueScript modules and standalone C files must live under this directory.

`entryFile` is the program that runs first. When you use `bscript project run --with-repl` or `--with-notebook`, this file runs before interactive mode starts.

`bscript project create` sets:

- `srcDir`: `"./src"`
- `entryFile`: `"./src/index.bs"`

If you omit these fields in an existing project, the compiler falls back to the project root:

- `srcDir`: `"."`
- `entryFile`: `"./index.bs"`

:::note Import paths
Relative `import` paths must resolve to files under `srcDir`. Importing from outside `srcDir` (for example with `../`) causes a compile error.
:::

### `dependencies`

Maps package names to Git repository URLs. An optional tag or branch can be appended after `#`.

```json
{
  "dependencies": {
    "gpio": "https://github.com/bluescript-lang/pkg-gpio-esp32.git",
    "drivers": "https://github.com/example/drivers.git#v1.0.0"
  }
}
```

Use `bscript project install` to add packages instead of editing this field by hand when possible.

## ESP32 fields

When `boardName` is `"esp32"`, the following additional field is available. These fields do not apply to `host` projects.

| Field | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `espIdfComponents` | No | `[]` | ESP-IDF component names to link when compiling Inline C code. |

```json
{
  "boardName": "esp32",
  "espIdfComponents": [
    "esp_driver_gpio"
  ]
}
```

See the [Inline C tutorial](../tutorial/guides/inline-c.md) for usage examples.

## Host example

A minimal `bsconfig.json` for the host runtime:

```json title="bsconfig.json (host)"
{
  "projectName": "hello-host",
  "boardName": "host",
  "version": "1.0.0",
  "vmVersion": "2.0.0",
  "srcDir": "./src",
  "entryFile": "./src/index.bs",
  "dependencies": {}
}
```

See [Try Without Microcontroller](../tutorial/guides/try-without-microcontroller.md) for setup steps.

## Generated project layout

A project created with `bscript project create` looks like this:

```
my-app/
├── bsconfig.json
├── src/
│   └── index.bs
├── dist/        (created on compile)
└── packages/    (created when you install packages)
```
