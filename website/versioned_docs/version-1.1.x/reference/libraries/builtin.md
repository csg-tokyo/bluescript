# Built-in Library

The built-in library provides essential utilities that are available in BlueScript without the need for installation or configuration.

## Usage

These functions are available solely by running the environment; no `import` or installation steps are required.

## Global Functions

### `print(message: any): void`

An alias for `console.log`. Outputs a message to the standard output (console), followed by a newline.

**Parameters**
- `message` (any): The value to log.

**Returns**
- `void`

**Example**
```ts
print("Hello, World!");
// Output: Hello, World!
```

## Console

### `console.log(message: any): void`

Outputs a message to the standard output (console), followed by a newline.

**Parameters**
- `message` (any): The value to log.

**Returns**
- `void`

**Example**
```ts
console.log("Hello, World!");
// Output: Hello, World!
```

### `console.error(message: any): void`

Outputs an error message to the standard error console.

**Parameters**
- `message` (any): The error value to log.

**Returns**
- `void`

**Example**
```ts
console.error("Critical failure");
// Output: Critical failure
```

## Time

### `time.now(): float`

Returns the current time as a floating-point number, representing the milliseconds elapsed since the BlueScript runtime started.

**Parameters**

This function takes no parameters.

**Returns**
- `float`: Milliseconds since startup.

**Example**
```ts
const current = time.now();
console.log(current);
// Output: 123.456 (example)
```

### `time.delay(ms: integer): void`

Synchronously pauses the program execution for a specified duration.

**Parameters**
- `ms` (integer): The number of milliseconds to wait.

**Returns**
- `void`

**Example**
```ts
console.log("Starting...");
time.delay(1000); // Wait for 1 second
console.log("Finished 1s delay");
```
