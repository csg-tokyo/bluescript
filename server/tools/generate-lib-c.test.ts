import * as fs from "fs";
import {generateC} from "./generate-c";


const libPath = "../lib/hardwarelib/hardwarelib.ts";
const targetCPath = "";

const bobPath = "../bob/bob.ts";
const targetCBobPath = "../esp32/main/user-program.c"

test("generate library c code", () => {
  const bsSrc = fs.readFileSync(libPath).toString();
  const cSrc = generateC(bsSrc);
  console.log(cSrc);
})

test("generate bob c code", () => {
  const libSrc = fs.readFileSync(libPath).toString();
  const bobSrc = fs.readFileSync(bobPath).toString();
  const cSrc = generateC(bobSrc, libSrc);
  console.log(cSrc);
})