# Create project and Run

Now that your environment is set up and the runtime is flashed to your device, let's write and run your first BlueScript program.

## Step 1: Create a Project

Create a new directory for your project. The CLI will generate the necessary configuration files.

```bash
bscript project create hello-bluescript
cd hello-bluescript
```

This creates a simple project structure:
*   `bsconfig.json`: Project configuration (see [bsconfig.json](/docs/reference/bsconfig) for details).
*   `src/`: Source directory (`srcDir` in `bsconfig.json`).
*   `src/index.bs`: Entry file (`entryFile` in `bsconfig.json`).

---

## Step 2: Write Code

Open `src/index.bs` in your code editor and write a simple program.

```typescript title="src/index.bs"
console.log("Hello world!");
```

---

## Step 3: Run Wirelessly

Make sure your ESP32 is powered on.
Since the runtime is already flashed, **you can disconnect the USB cable** and power the device via a battery or USB power bank.

Run the following command in your terminal:

```bash
bscript project run
```

### What happens next?

1.  **Scan:** The CLI scans for nearby BlueScript devices over Bluetooth.
2.  **Compile:** The CLI compiles your project into **Native Code** on your PC.
3.  **Upload:** Upon selecting your device, it transfers the binary via **Bluetooth**.
4.  **Execute:** The ESP32 executes the code immediately.

:::warning Program Lost on Restart
Please note that programs uploaded via `bscript project run` are **not persisted** after a reboot.

If you restart or power off the device, the program will be lost. You will need to execute `bscript project run` again to re-upload your code.

**Future Roadmap:**
We are planning to introduce a **`bscript project deploy`** command. This command will permanently install your application, allowing it to start automatically when the device powers on.
:::

:::tip Try interactive development
Want to experiment without editing files on every try? After you have a project, run **`bscript project run --with-notebook`** for a browser-based Notebook, or see [REPL & Notebook](/docs/tutorial/guides/repl) for all interactive modes.
:::

---
