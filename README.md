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

## Adding native functions
2 files should be update.
Consider the function name you want to add to be `NEW_NATIVE_FUNCTION`
1. ./esp32/main/utils.c
   ```C
    // Define function
    void fbody_NEW_NATIVE_FUNCTION(int32_t n) {
        ...
    }
    struct _NEW_NATIVE_FUNCTION { void (*fptr)(value_t); const char* sig; } _NEW_NATIVE_FUNCTION = { fbody_NEW_NATIVE_FUNCTION, "" };

    // Resister function to my_rel_table_entry.
    // struct my_rel_table_entry my_rel_table[100] = {
        {&_NEW_NATIVE_FUNCTION},
    // ...
    // }

   ```

2. ./server/data/native-function-skeltons.ts
   ```TypeScript
   function NEW_NATIVE_FUNCTION(n:integer) {}
   ```

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