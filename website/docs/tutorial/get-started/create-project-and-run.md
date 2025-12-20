# Create project and Run

Now that your environment is set up and the runtime is flashed to your device, let's write and run your first BlueScript program.

## Step 1: Create a Project

Create a new directory for your project. The CLI will generate the necessary configuration files.

```bash
blue create-project hello-bluescript
cd hello-bluescript
```

This creates a simple project structure:
*   `bsconfig.json`: Project configuration.
*   `index.bs`: Your entry point file.

---

## Step 2: Write Code

Open `index.bs` in your code editor and write a simple program.

```typescript title="index.bs"
console.log("Hello world!");
```

---

## Step 3: Run Wirelessly

Make sure your ESP32 is powered on.
Since the runtime is already flashed, **you can disconnect the USB cable** and power the device via a battery or USB power bank.

Run the following command in your terminal:

```bash
blue run
```

### What happens next?

1.  **Scan:** The CLI scans for nearby BlueScript devices over Bluetooth.
2.  **Compile:** The CLI compiles your project into **Native Code** on your PC.
3.  **Upload:** Upon selecting your device, it transfers the binary via **Bluetooth**.
4.  **Execute:** The ESP32 executes the code immediately.

:::tip Try the REPL
Want to test a command quickly without editing a file? Try the interactive mode!

Run **`blue repl`** in your terminal. You can type commands like `print("Hello")` and see the results instantly on the device.
:::

---

## Next Steps

Now that you have the basics down, explore what else BlueScript can do:

*   **[Language Reference](../../reference/language/intro)**: Learn about supported syntax, Inline C, and hardware APIs.
*   **[CLI Reference](../../reference/cli)**: Discover advanced commands.
