# Primitive Types

BlueScript provides six primitive types as well as object types:

- `integer` (30-bit integer)
- `int32` (32-bit integer)
- `number` (an alias of `integer`)
- `float` (30bit floating-point number)
- `string`
- `boolean`
- `null` and `undefined` (they are the same)
- `any`

Any kind of value can be implicitly converted into the `any` type, and vice versa.
  - Before being converted into the `any` type, an `integer` value may be stored as a 32-bit integer.
  - An `int32` value is always stored as a 32-bit integer.  It is never converted into the `any` type.
  - Before being converted into the `any` type, an `float` value may be stored as a 32-bit floating-point number.
    After being converted into the `any` type, it is stored as a 30-bit floating-point number,
    where only 6 bits are allocated for an exponent instead of 8 bits.
  - For logical operations and the condition expressions of coditional/loop statements
    such as `if` and `while`,
    0, 0.0, `false`, `null`, and `undefined` are considered as false while other values are true.
