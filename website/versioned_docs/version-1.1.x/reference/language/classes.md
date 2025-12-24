# Classes

An object is created as an instance of class.
The type of the object is its class name.
An object can be implicitly converted into `any` type, and vice versa.

## Class declarations

A class must be defined by a class declaration.
A class *expression* is not supported.
Classes are declared by using `class` keyword.


```tsx
class Rectangle {
  height: float;
  width: float;

  constructor(height: float, width: float) {
    this.height = height;
    this.width = width;
  }

  getArea() {
    return this.height * this.width;
  }
}

```

A property may have a type annotation, but a type annotation is optional.
In the code above, the types of properties `height` and `width` are `float`.

All class declarations, properties, and methods are `public`.
No access modifiers such as `private` and `readonly` are (*currently*) not supported.

## extends

A class can inherit from another class.
`extends` keyword is used to specify a super class.

```tsx
class Square extends Rectangle {
  constructor(sideLength: float) {
    super(sideLenght, sideLength);
  }
}
```

A constructor must first invokes the constructor of its super class.
A subclass is a subtype of the type representing its super class.

## new
`new` keyword is used to create a class instance.
```tsx
let rect = new Rectangle(13, 15);
```

## Properties and methods

Properties and methods are accessed using the dot notation.

```tsx
print(rect.height);    // 13
print(rect.getArea()); // 195
```

Unlike TypeScript, a method is not a property holding a function object.
It may not be accessed as a property.
For example, since `getArea` is a method, the following code is not valid in BlueScript.

```tsx
let m = rect.getArea;     // error
```

The `rect` objecrt does not have a property named `getArea`.

When a property's type is `integer` or `float`,
an object may hold only a 30bit value as the property's value.
If a class has a property of object type,
an `integer` or `float` property of its subclass holds a 30bit value.
Otherwise, it holds a 32bit value.

## Constructors

A property must be explicitly initailized in a constructor.
A property declaration (*currently*) must not have an initializer,
which is an expression computing the initial value of that property.

```tsx
class Rectangle {
  height: float = 10.0;    // error
  width: float = 10.0;     // error
}
```
This is valid in TypeScript, but it is *not* in BlueScript.
`= 10.0` must be erased.

In a constructor, a property is initialized through `this`.
`this` is a special variable that is available only in method bodies
and a constructor.
It refers to their object.
Unlike TypeScript, `this` is not available in a function body or at the top level.
