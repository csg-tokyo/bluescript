// This file was created for generate benchmark c file from bluescript file.
import {ErrorLog} from "../src/transpiler/utils";
import * as fs from 'fs'
import {transpile} from "../src/transpiler/code-generator/code-generator";
import {nbody_main} from "./playground";

const M_DIR_PATH = "../benchmarks/bluescript/macbook/";
const BENCHMARK_PATH = "../benchmarks/bluescript/";
const BENCHMARK_NAME = "sieve";

const prolog = `// predefined native functions
function newArray(n: integer, init: any): any[] { return []; }
function arrayLength(arr: any[]):integer { return 2 }
function assert(test: boolean) {}
function sqrt(target: float): float { return 0.0 }
function abs(i: integer): integer { return 0 }
function fabs(f: float): float { return 0.0 }
function console_log_float(f: float) {}
`
const prologCcode = `
#include "../../../m5stack_bluetooth/main/c-runtime.h"
#include "benchmark-utils.c"

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

test("exec playground code", () => {
  nbody_main();
})