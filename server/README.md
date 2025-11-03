# Run BlueScript on 64bit-Linux (or macOS) systems

## Requirement

- node.js

- The `cc` command for compilation of C programs

## Installation

Download BlueScript from GitHub:

```bash
git clone https://github.com/csg-tokyo/bluescript.git
```

and install it.

```bash
npm install
```

Move to the `./server` directory.

```bash
cd server
```

## Run the REPL

To run the REPL (Read-Eval-Print Loop) of BlueScript,

```bash
npm run shell
```

Built-in utility functions `print(v: any)`, `print_i32(v: integer)`, and `performance_now()` are available.

To close the shell,

```bash
> .quit
```

To read a source file and run its content,

```bash
> .load foo.bs
```

This reads `foo.bs` and runs the BlueScript program contained in that source file.

The source files can be given as command-line arguments.

```bash
npm run shell foo.bs bar.bs
```

This reads and runs `foo.bs` and `bar.bs` in this order when the REPL starts running.

Note that the REPL separately compiles every code fragment by users.
It performs the reading, compiling, running, and printing loop.
All the temporary files are stored in `./server/temp-files`.

## Compile a BlueScript program

To compile a BlueScript program,

```bash
npm run compile foo.bs bar.bs
```

This compiles `foo.bs` and `bar.bs` and generates the native binary,
which first runs `foo.bs` and then `bar.bs`.
If a function called in `foo.bs` is defined in `bar.bs`, a compilation error will
be reported.

To give an optional argument to the backend C compiler,

```bash
npm run compile foo.bs bar.bs --args=-g,-o,foo
```

Arguments specified with `--args=` are passed directly to the C compiler.
Commas within the argument string are automatically replaced with whitespace
to separate individual compiler options.
For example, the input `--args=-g,-o,foo` results in the compiler receiving
the arguments `-g -o foo`.