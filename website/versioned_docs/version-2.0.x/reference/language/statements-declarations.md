# Statements and Declarations

## Variable Declarations

Variables in BlueScript are declared using `let` or `const`.

```tsx
let x = 10;
let y: float = 5.5;
const t: boolean = true
```

Type annotations are optional.
When they are ommitted, the variables' types are determined by type inference.

## Loops

- **while loop**

  ```tsx
  let i = 0;
  while (i < 10) {
      print(i);
      i++;
  }
  ```

- **do-while loop**

  ```tsx
  let i = 0;
  do {
      print(i);
      i++;
  } while (i < 10);
  ```

- **for loop**

  ```tsx
  for (let i = 0; i < 10; i++) {
      print(i);
  }
  ```

- **break and continue**

  ```tsx
  for (let i = 0; i < 10; i++) {
      if (i == 5) {
          continue;
      }
      if (i == 8) {
          break;
      }
      print(i);
  }
  ```

## Conditional Statements

- **if … else …**

  ```tsx
  let a = 10;
  if (a > 5) {
      print("Greater than 5");
  } else {
      print("Less than or equal to 5");
  }
  ```
