import {execSync} from "child_process";
import SectionValueFactory from "../../src/linker/section-value-factory";
import {generateExpectedResult, getL32r, getLinkedCall8} from "./common";
import {Buffer} from "node:buffer";
import {SectionNameArr} from "../../src/models/section-model";
import * as fs from "fs";


describe('linker once test', () => {
  const dirPath = "./tests/linker/";

  for (let i = 0; i <= 7; i++) {
    test(`case${i}`, () => {
      const cFilePath = dirPath + `test-cases/case${i}.c`;
      const objFilePath = dirPath + `obj-files/case${i}.o`;
      const expectedResultPath = dirPath + `expected-results/case${i}.txt`;
      // 実行
      execSync(`xtensa-esp32-elf-gcc -c -O0 ${cFilePath} -o ${objFilePath} -w`);
      const sectionAddresses = {text: 100, literal: 0, data: 1000, rodata: 2000, bss: 3000};
      const symbolAddresses = {"blink_led": 1020, "console_log": 1030};
      const elfBuffer = fs.readFileSync(objFilePath);
      const factory = new SectionValueFactory(elfBuffer, symbolAddresses, sectionAddresses);
      const strategy = factory.generateStrategy();
      const values:{[name: string]: string} = {};
      SectionNameArr.forEach(sectionName => {
        const value = factory.generateSectionValue(sectionName);
        values[sectionName] = value.getLinkedValue(strategy).toString("hex");
      });
      const result = values.literal + values.text + values.data + values.rodata + values.bss
      // 検証
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