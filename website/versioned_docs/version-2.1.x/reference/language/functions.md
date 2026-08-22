# Functions

## Declarations
Functions are declared with the `function` keyword.
Function declarations must be at the top level.
They must not be declared inside a function body or an expression.

```tsx
function add(a: integer, b: integer): integer {
  return a + b;
}
```

A function parameter without a type annotation is typed as `any`.
A return type is optional.
When it is omitted, it is determined by type inference.
If type inference fails, the return type is either `any` or `void`.

A function can be redefined, but a new definition must share the same parameter types and return type.

## Arrow Functions

An arrow function is also available.  It can be created not only at the top level but also within a function body.
```tsx
let add = (a: integer, b: integer): integer => a + b;
```

An arrow function creates a closure.

An arrow function can be implicitly converted into
an `any`-type value, and vice versa.
When an `any`-type value is a function, it is callable.

```tsx
let add = (a: integer, b: integer): integer => a + b;
let f: any = add;
print(f(3, 20));    // call on any
let f2: (a: integer, b: integer) => integer = f
print(f2(30, 7))
```

However, a function cannot be implicitly converted into
a value of function type where some parameter types or a return type is changed into `any`-type.
For example,

```tsx
let add = (a: integer, b: integer): integer => a + b;
let f: any = add;                                   // OK
let add2: (a: any, b: integer) => integer = add;    // error since the first parameter's type is any
```

Similarly,

```tsx
let add = (a: integer, b: any): integer => a + b;
let add2: (a: integer, b: integer) => integer = add;  // error since the second parameter's type is integer
```
