# Introduction

BlueScript is a scripting language for programming a microcontroller.
It borrows its syntax from TypeScript
and hence it is regarded as a small subset of TypeScript.
But BlueScript also adopts several unique semantic differences from TypeScript.

BlueScript is a subset of TypeScript because, for example, it (*currently*) does not support exceptions, promises, async/await, or certain built-in objects.
On the other hand, unlike TypeScript, BlueScript supports `integer` and `float` primitive types,
and a BlueScript program is executed relying on static type information.
When a variable is statically typed as `integer`,
it always holds a native 32bit integer during runtime
as the C/C++ language does.  It never holds another type of value, and thus no runtime type check is necessary.
Furthermore, BlueScript supports simple gradual typing.
