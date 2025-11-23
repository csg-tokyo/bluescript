# Built-in Objects

## String

A `string` object represents a character string.  It is created from a string literal.

### Operators

A `string` object can be concatenated using the `+` and `+=` operators.
If one operand of `+` is a `string` object, the other operand
can be of any type: `string`, `integer`, `float`, `boolean`, `undefined`,
`null`, or `any`.
If the other operand is not a `string`, it is converted into a `string` object
before concatenation.
Similarly, if the left operand of `+=` is a `string` object,
the right operand can be of any type.

This is also true when `any` is the type of one operand of `+` or the left operand of `+=` but its value is a `string` object.
For example,

```tsx
let s: any = ' January '
let s2 = 1 + s            // '1 January '
s += 31                   // ' January 31'
```

Although the type of `s` is `any`, `1 + s` and `s += 31` are string concatenation.  `1` and `31` are integers, but they are converted
into `string` objects `'1'` and `'31'` before concatenation.

### Properties and methods

The read-only property `length` of `string` objects represents the length of
the character strings.

A `string` object accepts the following methods.

- `startsWith(prefix: string): boolean`

  returns `true` when the string starts with `prefix`.

- `endsWith(suffix: string): boolean`

  returns `true` when the string ends with `suffix`.

- `substring(start: integer, end: integer): string`

  returns the part of the string from the start index up to and
  excluding the end index.

## Array

An array object contains a collection of multiple items, which
are identified by an integer index.

### Array Objects

BlueScript currently supports arrays of `integer`, `float`, `boolean`, `string`, class types, 
array types, and `any`-type.
Their names are `T[]`, where `T` is an element type.

Array types are invariant.  For example, `integer[]` is not a subtype of `any[]` or its super type.
But array types can be implicitly converted into `any`-type, and vice versa.
In other words, a reference to an array of `integer`, `any`, etc. is implicitly converted into an `any`-type value.
An `any`-type value is also implicitly converted into a reference to an array
if the `any`-type value points to an array object of that array type.
Otherwise, a runtime error is thrown.

```tsx
let iarr: integer[] = [1, 2, 3]
let a: any = iarr
let i: integer = a[0]       // a[0] is an `any`-type value although iarr[0] is an integer
```

### Array Literals

Array literals are defined using square brackets, with elements separated by commas.

```tsx
let arr = [1, "Foo", 42];
```

The type of an array literal is array of the most specifict super 
type of the static types of all the elements.
If there exists such a super type, the type of the array literal is
array of `any`.

For example,

```tsx
let iarr = [1, 2, 3]                  // integer[]
let farr = [1.0, 2.0, 3.0]            // float[]
let sarr = ['one', 'two', 'three']    // string[]
let arr = [1, 2.0, 'three']           // any[]
```

### Array Construction

An array object is created by `new Array<T>(size, value)`.  Here, `T` is a meta variable representing a type name.
`size` is the number of the array elements.  `value` is the initial value for the array elements.
`T` can be `integer`, `float`, `boolean`, `string`, an array type, a class type, or `any`-type.

```tsx
let iarr = new Array<integer>(3, 0);
```

When the element type is `integer`, `float`, `boolean`, or `any`,
the second argument to the `Array` constructor can be omitted.
The initial values are zero, `false`, or `undefined`.
For example, `new Array<integer>(7)` is a valid expression, and it
constructs an array including 7 elements.

### Type Annotations

Array types are represented by `Type[]`.  Here, `Type` is a meta variable representing the type name of array elements.

```tsx
let iarr: integer[] = [1, 2, 3];
let sarr: string[] = ['one', 'two', 'three'];
```

Note that `Array` or `Array<integer>` is not a valid type name.

### Accessing Elements

Only numeric indices are supported for accessing array elements.

```tsx
let arr = [1, 3, 4];
print(arr[0]); // 1
```

Accessing an index out of bounds will result in a runtime error.

```tsx
let arr = [1, 2, 3];
print(arr[5]); // ** error: array index out of range: 5
```

The `length` property represents the length of an array.

```tsx
let arr = [1, 2, 3];
print(arr.length);    // 3
```

If the type of `arr` is `any`-type, the type of `arr[i]` is `any`.
`arr[i] = v` throws a runtime error 
if `v` is not a value of the element type for the array
that `arr` points to.
For example,

```tsx
let arr: integer[] = [1, 2, 3];
let arr2: any = arr;
print(arr2.length)        // 3
print(arr2[0])            // 1
print(typeof arr2[0]);    // 'any'
arr2[1] = 'five';         // runtime error
```

Arrays of `integer`, `float`, `boolean`, and `string`
are fixed-length arrays.
Currently, array methods such as `push`, `pop`, `map`, `filter`, etc., are not supported in BlueScript.

### Byte arrays

An `Uint8Array` object is also available.  Its elements are unsigned 8 bit integers, and its length is fixed.

```tsx
let arr = new Uint8Array(3, 0)    // create an array containing 3 elements.  Their initial values are 0.
print(arr[1])      // 0
arr[0] = 7
print(arr[0])      // 7
print(arr.length)  // 3
```

The second argumemnt to the constructor of `Uint8Array` cannot be omitted.

### `Vector` class

A `Vector` object is a fixed-length array.  Its element type is `any`.

```tsx
let arr = new Vector(3, undefined)  // create an array containing 3 elements.  Their initial value is undefined.
print(arr[1])      // undefined
arr[0] = 7
print(arr[0])      // 7
print(arr.length)  // 3
```

A `Vector` object is accessible by the `[]` operator as an array of type `integer[]` is.

### Properties and methods

The read-only property `length` of array objects represents the length of the arrays.
The following methods are available:

- `push(e: T): integer`

  adds an element `e` to the end of an array and returns the new length of the array.

- `pop(): T`

  removes the last element of an array and returns that element.

- `unshift(e: T): integer`

  adds an element `e` to the beginning of an array and returns the new length of the array.

- `shift(): T`

  removes the first element `e` and returns that element.

Here, `T` is an element type.

However, arrays of `integer`, `float`, or `boolean` do not accept these methods.
`Uint8Array`, or `Vector` do not accept them, either.
They are fixed-length arrays.
