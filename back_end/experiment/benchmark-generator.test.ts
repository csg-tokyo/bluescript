// This file was created for generate benchmark c file from bluescript file.
import {ErrorLog} from "../src/transpiler/utils";
import * as fs from 'fs'
import {transpile} from "../src/transpiler/code-generator/code-generator";

const M_DIR_PATH = "../benchmarks/bluescript/macbook/";
const BENCHMARK_PATH = "../benchmarks/bluescript/";
const BENCHMARK_NAME = "sieve";

const prolog = `// predefined native functions
function newArray(n: integer, init: any): any[] { return []; }
function assert(test: boolean) {}
`
const prologCcode = `
#include "c-runtime.h"
#include "utils.c"

`

function generateBenchmarkCode(src: string) {
  const result1 = transpile(1, prolog)
  let globalNames = result1.names
  let result2
  try {
    result2 = transpile(2, src, globalNames, 1)
  }
  catch (e) {
    if (e instanceof ErrorLog)
      throw e.toString()
    console.log(JSON.stringify(e))
    throw e
  }
  return result2.code;
}


test("generate code", () => {
  const src = fs.readFileSync(BENCHMARK_PATH + BENCHMARK_NAME + ".ts").toString();
  const code = generateBenchmarkCode(src);
  fs.writeFileSync(M_DIR_PATH + BENCHMARK_NAME + ".c", prologCcode + code)
})