import * as fs from "fs";
import {generateC} from "./generate-c";


const libPath = "../lib/hardwarelib/hardwarelib.ts";
const targetCPath = "";

test("generate library c code", () => {
  const bsSrc = fs.readFileSync(libPath).toString();
  const cSrc = generateC(bsSrc);
  console.log(cSrc);
})