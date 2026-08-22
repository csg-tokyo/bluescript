# Enum type

Enum types are used to define a set of named integer constants.
All enum members must be explicitly assigned integer literals. 
They cannot be assigned string literals.
Enum members are not implicitly initialized with auto-incremented
values.  Their values must be explicitly given.

```tsx
enum Color { Red = -1, Green = 0, Blue = 1 }
```

Enum declarations must be at top-level.  They may not be contained in a function body.

An enum type is intended to be a subtype of integer.
But a variable of enum type may
hold an arbitrary integer value.  For example,

```tsx
const i = 2
let c: Color = i    // type error
```

This causes a static type error since `i` is statically typed as integer
but the type of `c` is `Color`.  Integer type is not a subtype of `Color`.
However,

```tsx
let k: Color = (i as any)    // OK
```

When a variable of `any` type holds an integer value, the value may be
assigned to a variable of enum type.
Currently, no runtime type checking is performed.
