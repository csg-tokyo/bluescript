# BlueScript

## Directories
```
|- server // Node.js server for compiling BlueScript code.
|- notebook // React app for showing REPL to users.
|- esp32 // ESP-IDF app for recieving and executing binaries. 
```

## Setting Up BlueScript

### Preparation
1. Install node, npm and react.
2. Install ESP-IDF by following this [page](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/index.html).
3. Prepare microcontroller with ESP32 core.

### 1. Installing BlueScript app to microcontroller 
1. Confirm the microcontroller is connected to your Host machine by serial cable.
2. Open a new tab in terminal and move to `./esp32/`.
3. Run the following command.
   ```bash
    idf.py build flash monitor
   ```
   
### 2. Launching local server
1. Open a new tab in terminal and move to `./server/`
2. Run the following command.
   ```
   npm run exec
   ```

### 3. Launching REPL
1. Open a new tab in terminal and move to `./notebook/`
2. Run the following command.
   ```
   npm start
   ```
3. Open a new tab in browser and access to `localhost:3000/repl`

## Adding library functions
Add new function to `./esp32/components/lib/`.
You can use `./lib/` and `./server/tools/generate-c.ts`.


## Adding runtime functions
4 files should be update.
Consider the function name you want to add to be `NEW_RUNTIME_FUNCTION`
1. ./esp32/main/c-runtime.c
2. ./esp32/main/c-runtime.h
```c
// You should add attribute as follows so that the function won't deleted by the linker.
// (The linker delete the unused functions.)
extern void CR_SECTION NEW_RUNTIME_FUNCTION();
```