import {execSync} from "child_process";
import SectionValueFactory from "../../src/linker/section-value-factory";
import {generateExpectedResult, getL32r, getLinkedCall8} from "./common";
import {Buffer} from "node:buffer";
import * as fs from "fs";
import CONSTANTS from "../../src/constants";

describe('linker test', () => {
  const dirPath = "./tests/linker/";

  for (let i = 0; i <= 7; i++) {
    test(`case${i}`, () => {
      // Files
      const cFilePath = dirPath + `test-cases/case${i}.c`;
      const objFilePath = dirPath + `obj-files/case${i}.o`;
      const expectedResultPath = dirPath + `expected-results/case${i}.txt`;

      // Prepare data.
      const sectionAddresses = {".text": 100, ".literal": 0, ".data": 1000, ".rodata": 2000, ".bss": 3000};
      const symbolAddresses = {"blink_led": 1020, "console_log": 1030};
      execSync(`xtensa-esp32-elf-gcc -c -O0 ${cFilePath} -o ${objFilePath} -w`);
      const elfBuffer = fs.readFileSync(objFilePath);

      // Link.
      const factory = new SectionValueFactory(elfBuffer, symbolAddresses, sectionAddresses)
      const strategy = factory.generateStrategy()
      let result = ""
      CONSTANTS.VIRTUAL_SECTION_NAMES.forEach(sectionName => {
        const value = factory.generateSectionValue(sectionName.realName)
        result += value.getLinkedValue(strategy).toString("hex")
      });

      // Verify
      const expectedResult = generateExpectedResult(expectedResultPath);
      expect(result).toBe(expectedResult);
    })
  }
});


describe("dummy", () => {
  test("call8", () => {
    const buf: Buffer = Buffer.allocUnsafe(3);
    buf.writeIntLE(getLinkedCall8(0, 14), 0, 3);
    console.log(buf.toString("hex"));
  });

  test("l32r", () => {
    const buf: Buffer = Buffer.allocUnsafe(3);
    buf.writeIntLE(getL32r(0x21, 1074362844, 1074362949), 0, 3);
    console.log(buf.toString("hex"));
  })
})