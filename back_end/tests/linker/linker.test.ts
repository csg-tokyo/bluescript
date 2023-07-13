import * as fs from "fs";
import {execSync} from "child_process";
import FILE_PATH from "../../src/constants";
import link, {addressTableOrigin} from "../../src/linker";
import {translateExe} from "./common";
import {Buffer} from "node:buffer";
import {AddressTableOrigin} from "../../src/linker/address-table";

// File Path
const MOCK_MCU_C_FILE = "./temp-files/mock-mcu.c";
const MOCK_MCU_OBJ_FILE ="./temp-files/mock-mcu.o";
const TEST_C_FILE = "./temp-files/linker-test.c";
const TEST_OBJ_FILE = "./temp-files/linker-test.o";

const mockMCUCode = `
#include "stdint.h"

void _blink_led() {};
void _console_log(char *str) {};

uint8_t virtual_text[1000];
uint8_t virtual_literal[500];
uint8_t virtual_data[1000];

int main() { return 2; }
`

const nativeSymbolNames = ["_blink_led", "_console_log"];


describe('test linker', () => {
  let addressTable: AddressTableOrigin;

  beforeAll(() => {
    fs.writeFileSync(MOCK_MCU_C_FILE, mockMCUCode);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -O2 ${MOCK_MCU_C_FILE} -o ${MOCK_MCU_OBJ_FILE} -w`);
    FILE_PATH.MCU_ELF = MOCK_MCU_OBJ_FILE;
    addressTable = addressTableOrigin(nativeSymbolNames);
  });

  test("test single main function", () => {
    const cCode = `
    #include "stdint.h"
      
    uint32_t bluescript_main() {
      return 2;
    }
  `

    const expectedExe = `
    <.header>
    # section length
    text: 0007
    literal: 0000
    data: 0000
    
    entrypoint: 004015d4

    <.text>
    # bluescript_main
    0: 364100
    3: 0c22
    5: 1df0 
  `

    fs.writeFileSync(TEST_C_FILE, cCode);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O2 ${TEST_C_FILE} -o ${TEST_OBJ_FILE} -w`);
    const elfBuffer = fs.readFileSync(TEST_OBJ_FILE);
    const {exe} = link(elfBuffer, "bluescript_main", addressTable);
    expect(exe).toBe(translateExe(expectedExe));
  });

  test("test two functions", () => {
    const cCode = `
    #include "stdint.h"
      
    uint32_t func1() {
        return 3;
    }
    
    uint32_t bluescript_main() {
        return func1();
    }
  `

    const expectedExe = `
    <.header>
    # section length
    text: 0018
    literal: 0000
    data: 0000
    
    entrypoint: 004015e0

    <.text>
    # func1
    00: 364100
    03: 7d01
    05: 0c32
    07: 1df0
    09: 000000
    
    # bluescript_main
    12: 364100
    15: 7d01
    17: e5feff
    20: 2d0a
    22: 1df0
  `

    fs.writeFileSync(TEST_C_FILE, cCode);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O0 ${TEST_C_FILE} -o ${TEST_OBJ_FILE} -w`);
    const elfBuffer = fs.readFileSync(TEST_OBJ_FILE);
    const {exe} = link(elfBuffer, "bluescript_main", addressTable);
    expect(exe).toBe(translateExe(expectedExe));
  });

  test("test usage of native function", () => {
    const cCode = `
    #include "stdint.h"
      
    uint32_t bluescript_main() {
        _blink_led();
        return 4;
    }
  `

    const expectedExe = `
    <.header>
    # section length
    text: 000a
    literal: 0000
    data: 0000
    
    entrypoint: 004015d4

    <.text>    
    # bluescript_main
    00: 364100
    03: a5bbfe
    06: 0c42
    08: 1df0
  `

    fs.writeFileSync(TEST_C_FILE, cCode);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O2 ${TEST_C_FILE} -o ${TEST_OBJ_FILE} -w`);
    const elfBuffer = fs.readFileSync(TEST_OBJ_FILE);
    const {exe} = link(elfBuffer, "bluescript_main", addressTable);
    expect(exe).toBe(translateExe(expectedExe));
  });

  test("test usage of string", () => {
    const cCode = `
    #include "stdint.h"
      
    uint32_t bluescript_main() {
        _console_log("Hello world");
        _console_log("Hello world2");
        return 4;
    }
  `

    const expectedExe = `
    <.header>
    # section length
    text: 0014
    literal: 0008
    data: 0019
    
    entrypoint: 004015d4

    <.text>    
    # bluescript_main
    00: 364100
    03: a1f900
    06: 22a004
    09: a5bbfe
    0c: a1f800
    0f: 65bbfe
    12: 1df0
    
    <.literal>
    00: ec114000
    04: f8114000
    
    <.rodata.str1.4>
    00: 48656c6c6f20776f726c6400
    0c: 48656c6c6f20776f726c643200
  `

    fs.writeFileSync(TEST_C_FILE, cCode);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O2 ${TEST_C_FILE} -o ${TEST_OBJ_FILE} -w`);
    const elfBuffer = fs.readFileSync(TEST_OBJ_FILE);
    const {exe} = link(elfBuffer, "bluescript_main", addressTable);
    expect(exe).toBe(translateExe(expectedExe));
  });

  test("test usage of global variable", () => {
    const cCode = `
    #include "stdint.h"
    
    char* str = "Hello";  
    uint32_t bluescript_main() {
        _console_log(str);
        return 4;
    }
  `

    const expectedExe = `
    <.header>
    # section length
    text: 000f
    literal: 0004
    data: 000a
    
    entrypoint: 004015d4

    <.text>    
    # bluescript_main
    00: 364100
    03: 81f900
    06: 0c42
    08: a808
    0a: a5bbfe
    0d: 1df0
    
    <.literal>
    00: ec114000
    
    <.data>
    00: f0114000
    
    <.rodata.str1.4>
    00: 48656c6c6f00
  `

    fs.writeFileSync(TEST_C_FILE, cCode);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O2 ${TEST_C_FILE} -o ${TEST_OBJ_FILE} -w`);
    const elfBuffer = fs.readFileSync(TEST_OBJ_FILE);
    const {exe} = link(elfBuffer, "bluescript_main", addressTable);
    expect(exe).toBe(translateExe(expectedExe));
  });

  test("test usage of while", () => {
    const cCode = `
    #include "stdint.h"
    
    uint32_t bluescript_main() {
        int i = 0;
        while (i < 10) {
            i++;
        }
        return i;
    }
  `

    const expectedExe = `
    <.header>
    # section length
    text: 001b
    literal: 0000
    data: 0000
    
    entrypoint: 004015d4

    <.text>    
    # bluescript_main
    0: 366100 
    03: 7d01     
    05: 0c02  
    07: 2907     
    09: 460100  
    0c: 2807  
    0e: 1b22   
    10: 2907   
    12: 2807      
    14: a692f4     
    17: 2807  
    19: 1df0 
  `

    fs.writeFileSync(TEST_C_FILE, cCode);
    execSync(`export PATH=$PATH:${FILE_PATH.GCC}; xtensa-esp32-elf-gcc -c -O0 ${TEST_C_FILE} -o ${TEST_OBJ_FILE} -w`);
    const elfBuffer = fs.readFileSync(TEST_OBJ_FILE);
    const {exe} = link(elfBuffer, "bluescript_main", addressTable);
    expect(exe).toBe(translateExe(expectedExe));
  });

});


test("dummy", () => {

  const CALL8 = (to: number, from: number) => (to - (from & (-4)) - 4) * 16 + 0b100101;
  const L32R = (base: number, to: number, from: number) => (to - ((from + 3) & (-4)) << 6) + base

  const buf: Buffer = Buffer.allocUnsafe(3);
  // buf.writeIntLE(L32R(0x81, 0x004019bc + 0x00, 0x004015d4 + 0x03), 0, 3);
  buf.writeIntLE(CALL8(0x00400198, 0x004015d4 + 0x0a), 0, 3);
  console.log(buf.toString("hex"));
});