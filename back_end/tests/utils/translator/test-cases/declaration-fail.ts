const DeclarationFailCases:{input: string}[] = [
  {
    input: "const i:number = \"hello\";",
  },
  {
    input: "let i:integer = 3.1;",
  },
  {
    input: "func1();"
  }
]

export default DeclarationFailCases;
