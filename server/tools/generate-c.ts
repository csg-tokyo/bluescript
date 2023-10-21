import {transpile} from "../src/transpiler/code-generator/code-generator";
import {GlobalVariableNameTable} from "../src/transpiler/code-generator/variables";

export function generateC(bs: string, prolog?: string, header?: string): string {
  let names: GlobalVariableNameTable;
  if (prolog) {
    const result0 = transpile(1, prolog);
    names = result0.names;
    return transpile(2, bs, names, 1, header).code;
  }
  return transpile(2, bs, undefined, 1, header).code;
}

