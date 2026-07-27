# Nullable type

A class type is not a super type or a subtype of `null` type.
So, a variable of a class type may not be set to `null`.
Only a variable of a nullable type may be set to `null`.

A nullable type is constructed from a class type.
Suppose that `T` is a class type name.
Then, `T | null` and `T | undefined` are nullable types
(Note that `null` and `undefiend` are identical in BlueScript).
A variable of `T | null` may be set to either a `T` object or `null` (or `undefined`).

```tsx
let r: Rectangle | null = null
r = new Rectangle(3.0, 4.0)
```

A nullable type is also constructed from the `string` type and array types.
All the following types are valid nullable types.

```tsx
string | null
integer[] | null
string[] | null
Uint8Array | null
```

However, `integer | null` or `float | null` is not a valid type.

## Subtyping

If type `T` is a subtype of `S`, then `T | null` is also a subtype of `S | null`.

## Type guards

BlueScript (*currently*) supports only a very simple type guard.
If a local varialbe of type `T | null` is tested for null in the condition expression
of a `if` statement, that variable is treated
as a variable of type `T` in the *then* clause or the *else* clause.

```tsx
function area(r: Rectangle | null): float {
  if (r == null)
    return 0.0;
  else {
    // the static type of r is Rectangle.  Not Rectangle | null.
    return r.getArea();
  }
}
```

The expressions for testing must be either _&lt;variable&gt;_ `== null` or _&lt;variable&gt;_ `!= null`.
