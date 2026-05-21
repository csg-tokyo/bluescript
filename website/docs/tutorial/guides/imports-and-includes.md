# Imports & Includes

As your project grows, you will want to split your code into multiple files.
BlueScript handles dependencies differently depending on whether you are loading **BlueScript Modules** or raw **C Source Files**.

## Importing BlueScript Modules

You can create reusable BlueScript code (`.bs` files) and import them into other files.

### 1. Local Modules
To import a module from your own project, use the **relative path** (starting with `./` or `../`).

**`src/math-utils.bs`** (The library)
```typescript
// Named export
export function add(a: integer, b: integer): integer {
    return a + b;
}

// ❌ Default export is NOT supported
// export default function ...
```

**`src/index.bs`** (The importer)
```typescript
// Import using relative path
import { add } from "./math-utils";

console.log(add(10, 20));
```

:::warning No Default Exports
BlueScript currently supports only **Named Exports**.
You must use `import { name }` syntax. `import name from ...` will not work.
:::

### 2. Package Modules
When you install an external library (like a driver), you import it by its **Package Name**, not a file path.

```typescript
// Import from an installed package
// The compiler resolves "gpio" from your project config
import { GPIO } from "gpio";
```

## Including C Files

If you have standalone C source files (`.c`) in your project, you can include them using **Inline C**.

Unlike standard C compilers, BlueScript's `code` block treats `#include` paths relative to the current file when using quotes.

**`src/native-lib.c`**
```c
// A pure C function
int native_multiply(int a, int b) {
    return a * b;
}
```

**`src/index.bs`**
```typescript
// Include the local C file
code`#include "./native-lib.c"`

export function multiply(a: integer, b: integer): integer {
    let result = 0;
    // Call the function defined in the included C file
    code`${result} = native_multiply(${a}, ${b});`
    return result;
}

console.log(multiply(3, 4));
```

### Summary table

| Source Type | Syntax | Path Style | Example |
| :--- | :--- | :--- | :--- |
| **Local BS Module** | `import { ... }` | Relative | `"./utils"` |
| **Package BS Module** | `import { ... }` | Package Name | `"gpio"` |
| **Local C File** | `code`\`#include ...\` | Relative | `"./driver.c"` |
