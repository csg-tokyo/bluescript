const DeclarationCases:{input: string, output: string}[] = [
  {
    input: "const i:number = 3;",
    output: "volatile static const value_t i = int_to_value(3);\n",
  },
  {
    input: "let i:number = 3;",
    output: "volatile static value_t i = int_to_value(3);\n",
  },
  {
    input: "var i:number = 3;",
    output: "volatile static value_t i = int_to_value(3);\n",
  },
  {
    input: "let i:integer = 3;",
    output: "volatile static value_t i = int_to_value(3);\n",
  },
  {
    input: "let i:float = 4.1;",
    output: "volatile static value_t i = float_to_value(4.1);\n",
  },
  // {
  //   input: "const s:string = \"Hello World!\";",
  //   output: "const char* s = \"Hello World!\";\n"
  // },
  // {
  //   input: "let s:string = \"Hello World!\";",
  //   output: "char* s = \"Hello World!\";\n"
  // },
  // {
  //   input: "var s:string = \"Hello World!\";",
  //   output: "char* s = \"Hello World!\";\n"
  // },
  // {
  //   input: "let b:boolean = false;",
  //   output: "int b = 0;\n"
  // },
  // {
  //   input: "function func01(n:number):number {return 2;}",
  //   output: "int func01(int n) {\n" +
  //     "return 2;\n" +
  //     "};\n"
  // },
  // {
  //   input: "function func01(a:number, b:number):number {return a + b;}",
  //   output: "int func01(int a, int b) {\n" +
  //     "return a + b;\n" +
  //     "};\n"
  // }
]

export default DeclarationCases;
