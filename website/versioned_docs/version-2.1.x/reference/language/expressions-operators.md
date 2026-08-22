# Expressions and Operators

## Operators

### Increment and Decrement Operators

The operands' types of the increment and decrement operators must be `integer`, `float`, or `any`.

- **Postfix Increment/Decrement Operators**  
  The value is incremented or decremented by 1, and the original value is returned.

  ```tsx
  let x = 1;
  print(x++); // 1
  print(x);   // 2
  
  let y = 1.0;
  print(y--); // 1.0
  print(y);   // 0.0
  ```

- **Prefix Increment/Decrement Operators**  
  The value is incremented or decremented by 1, and the updated value is returned.

  ```tsx
  let x = 1;
  print(++x); // 2
  print(x);   // 2
  ```

### Unary Operators

BlueScript supports the following unary operators:

- `+` (Unary plus)

  It returns the value of its operand.
  The operand's type must be `integer`, `float`, or `any`.

- `-` (Unary negation)

  It returns the negation of its operand.
  The operand's type must be `integer`, `float`, or `any`.

- `~` (Bitwise NOT)

  The operand's type must be `integer` or `any`.

- `!` (Logical NOT)

  The operand's type can be any kind of type.

The following example shows the use of the unary negation.

```tsx
print(-3)  // -3
```

### Arithmetic Operators

The operands' types must be `integer`, `float`, or `any`.
If either the left operand or the right operand is `any`, the resulting type is `any`.
If either left or right is `float`, the resulting type is `float`.  Otherwise, it is `integer`.

- `+` (Addition)
- `-` (Subtraction)
- `*` (Multiplication)
- `/` (Division)
- `%` (Modulus)

  The operands must be an `integer` value or an `any`-type value holding an `integer` value.

- `**` (Exponentiation)

  The operands are converted into `double` values, and `pow()` in C computes the result.

### Relational Operators

The operands' types must be `integer`, `float`, `string`, or `any`.  The resulting type is `boolean`.  Both operands share the same type or `any`-type.
If a left or right operand is `any`-type, the value of the other operand is converted into an `any`-type value before comparison.

- `<` (Less than)
- `>` (Greater than)
- `<=` (Less than or equal to)
- `>=` (Greater than or equal to)


### Equality Operators

- `==` and `===` are used as equality operators.
   Their semantics is the same as the `===` operator in JavaScript.
- `!=` and `!==` are used as inequality operators.
   Their semantics is the same as the `!==` operator in JavaScript.

If either the left operand or the right operand is a `boolean` type,
the other operand must be also `boolean` type.


### Bitwise Shift Operators

The operands' types must be `integer`.  It may not be `any`-type.  The type of the resulting value is `integer`.

- `<<` (Left shift)
- `>>` (Right shift)
- `>>>` (Unsigned right shift)

### Binary Bitwise Operators

The operands' types must be `integer`.  It may not be `any`-type.  The type of the resulting value is `integer`.

- `&` (AND)
- `|` (OR)
- `^` (XOR)

### Binary Logical Operators

- `&&` (Logical AND)
- `||` (Logical OR)


### Type operators

- `typeof`

  It returns the *static* type name of its operand. Unlike JavaScript, it is not a dynamic type name.

- `instanceof`

  It checks whether the left operand is an instance of the class given as the right operand or its subclass.
  The right operand may be `string` or `Array`.  The type of the left operand must be 
  a class type, `string`, an array type, or `any`.

`obj instanceof Array` results in `true` when `obj` is an array object no matter what its element type is.

### Ternary Operator

The ternary operator `? :` is used for conditional expressions:

```tsx
let result = condition ? trueValue : falseValue;
```

### Assignment Operators

BlueScript supports the following assignment operators:

- `=`
- `+=`, `-=`, `*=`, `/=`

  Compound assignment operators.  The operands' type must be `integer`, `float`, or `any`.

- `%=`

  The operands' type must be `integer` or `any`.
