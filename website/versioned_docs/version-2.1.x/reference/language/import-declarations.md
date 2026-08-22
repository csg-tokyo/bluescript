# Import declaration

An `import` declaration imports variables, functions, and classes
from another source file.
It allows only the named import using the following syntax.

```tsx
import { abs, max } from './math.bs'
```

This imports functions `abs` and `max` declared in the source file
`./math.bs`.
These functions must be declared with the `export` modifier.

Furthermore, the `import type` declaration is a valid syntax in BlueScript,
but this declaration is ignored.

```tsx
import type { integer, float } from './types.ts'
```

This declaration is useful when using a TypeScript editor for  editing a BlueScript program.
The builtin types `integer` and `float` will
be treated as valid type names when the contents of `./types.ts` are as follows.

```tsx
export type integer = number
export type float = number
```
