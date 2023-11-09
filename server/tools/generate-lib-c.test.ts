import * as fs from "fs";
import {generateC} from "./generate-c";


const libPath = "../lib/hardwarelib/hardwarelib.ts";
const targetCPath = "";

const bobPath = "../user-program/user-program.ts";
const targetCBobPath = "../esp32/main/user-program.c"
const bobHeader = `
#include <stdint.h>
#include "c-runtime.h"
#include "hardwarelib.h"
`

test("generate library c code", () => {
  const bsSrc = fs.readFileSync(libPath).toString();
  const cSrc = generateC(bsSrc);
  console.log(cSrc);
})

test("generate user-program c code", () => {
  const libSrc = fs.readFileSync(libPath).toString();
  const bobSrc = fs.readFileSync(bobPath).toString();
  const cSrc = generateC(bobSrc, libSrc, bobHeader);
  fs.writeFileSync(targetCBobPath, cSrc);
  console.log(cSrc);
})