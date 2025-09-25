# Primitive Types

BlueScript provides six primitive types as well as object types:

- `integer` (32bit integer)
- `number` (an alias of `integer`)
- `float` (32bit floating-point number)
- `string`
- `boolean`
- `null` and `undefined` (they are the same)
- `any`

Any kind of value can be implicitly converted into `any` type, and vice versa.
  - When an `integer` value is converted, the resulting value is represented as a 30bit integer.
  - When a `float` value is converted, the resulting value is represented as a 30bit floating-point number,
    where only 6 bits are allocated for an exponent instead of 8 bits.
  - For logical operations and the condition expressions of coditional/loop statements
    such as `if` and `while`,
    0, 0.0, `false`, `null`, and `undefined` are considered as false while other values are true.
