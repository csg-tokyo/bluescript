const ExpressionStatementCases:{input: string, output: string}[] = [
  {
    input: "1 + 1 + 1;",
    output: "1 + 1 + 1;\n"
  },
  {
    input: "2 - 3;",
    output: "2 - 3;\n"
  },
  {
    input: "1 + (1 + 1);",
    output: "1 + (1 + 1);\n"
  },
  {
    input: "1 + 3.2;",
    output: "1 + 3.2;\n"
  },
  {
    input: "i = i + 1;",
    output: "i = int_to_value(value_to_int(i) + 1);\n"
  },
  {
    input: "f = 1.2 + 1.3;",
    output: "f = float_to_value(1.2 + 1.3);\n"
  },
  {
    input: "f = f + 1;",
    output: "f = float_to_value(value_to_float(f) + 1);\n"
  },
  {
    input: "i = i;",
    output: "i = i;\n"
  },
  {
    input: "func1(1, 2);",
    output: "func1(int_to_value(1), float_to_value(2));\n"
  },
  {
    input: "func2();",
    output: "func2();\n"
  },
  {
    input: "i = func2();",
    output: "i = func2();\n"
  }
  // {
  //   input: "i++;"
  //   output: "i++;\n"
  // },
  // {
  //   input: "--i;",
  //   output: "--i;\n"
  // }
]

export default ExpressionStatementCases;