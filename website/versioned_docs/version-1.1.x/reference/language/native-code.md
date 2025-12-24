# Native code

The code written in the C language can be embedded in a BlueScript program.
The string literal surrounded with backquotes following `code` is directly embedded
in the C program after transpilation.

```tsx
code`#include <math.h>`

function sqrt(x: float): float {
  let r: float
  code`${r} = sqrt(${x})`
  return r
}

print(sqrt(9.0))
```

A BlueScript variable is referred to by `${}`.
The content between `${` and `}` must be a variable name or this object's property.
For example above, `${x}` adn `${r}` refer to the BlueScript variable `x` and `r` respectively.
The embedded C code calls the function `sqrt` in the standard C library and assigns the retrun value
to the BlueScript variable `r`.
The argument passed to `sqrt` is the value of the BlueScript variable `x`.

To suppress an error message by a TypeScript editor, declare this function:

```tsx
function code(strings: any, ... keys: any[]) {}
```

BlueScript ignores this function declaration.
