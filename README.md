# BlueScript

## Directories
```
|- back_end // Node.js server for compiling BlueScript code.
|- front_end // React app for showing REPL to users.
|- m5stack_bluetooth // ESP-IDF app for recieving and executing binaries. 
```

## Setting Up BlueScript

### Preparation
1. Install node, npm and react.
2. Install ESP-IDF by following this [page](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/index.html).
3. Prepare microcontroller with ESP32 core.

### 1. Installing BlueScript app to microcontroller 
1. Confirm the microcontroller is connected to your Host machine by serial cable.
2. Open a new tab in terminal and move to `./m5stack_bluetooth/`.
3. Run the following command.
   ```bash
    idf.py build flash monitor
   ```
   
### 2. Launching local server
1. Open a new tab in terminal and move to `./back_end/`
2. Run the following command.
   ```
   npm run exec
   ```

### 3. Launching REPL
1. Open a new tab in terminal and move to `./front_end/`
2. Run the following command.
   ```
   npm start
   ```
3. Open a new tab in browser and access to `localhost:3000/repl`

## Adding native functions
2 files should be update.
Consider the function name you want to add to be `NEW_NATIVE_FUNCTION`
1. ./m5stack_bluetooth/main/utils.c
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

2. ./back_end/data/native-function-skeltons.ts
   ```TypeScript
   function NEW_NATIVE_FUNCTION(n:integer) {}
   ```

## Adding runtime functions
4 files should be update.
Consider the function name you want to add to be `NEW_RUNTIME_FUNCTION`
1. ./m5stack_bluetooth/main/c-runtime.c
2. ./m5stack_bluetooth/main/c-runtime.h
3. ./m5stack_bluetooth/main/utils.c
   ```C
   // Resister function to my_rel_table_entry.
    // struct my_rel_table_entry my_rel_table[100] = {
        {&_NEW_RUNTIME_FUNCTION},
    // ...
    // }
   ```
4. ./back_end/data/c-runtime-symbols.json
   ```typescript
   // [
    "NEW_RUNTIME_FUNCTION",
   // ... 
   //]
   ```