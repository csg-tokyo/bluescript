import {LinkerScript, LinkerScriptMemoryRegion, LinkerScriptSection, LinerScriptMemoryAttribute} from "../../src/compiler/linker-script";

test('generate linker script.', () => {
  const linkerScriptMemory1 = new LinkerScriptMemoryRegion(
    'IRAM',
    [new LinerScriptMemoryAttribute('executable')],
    0x4000,
    150)
  const linkerScriptMemory2 = new LinkerScriptMemoryRegion(
    'DRAM',
    [new LinerScriptMemoryAttribute('read/write'), new LinerScriptMemoryAttribute('readonly')],
    0x3000,
    150)
  const linkerScriptMemory3 = new LinkerScriptMemoryRegion(
    'EXTERNAL_SYMBOLS',
    [new LinerScriptMemoryAttribute('executable')],
    0x000,
    1000000000)
  const linkerScriptSection1 = new LinkerScriptSection('.iram1', linkerScriptMemory1)
    .align(4)
    .section('obj1.o', ['.iram'], true);
  const linkerScriptSection2 = new LinkerScriptSection('.dram', linkerScriptMemory2)
    .align(4)
    .section('obj1.o', ['.dram', '.data*']);
  const linkerScriptSection3 = new LinkerScriptSection('.external_symbols', linkerScriptMemory3)
    .symbol('symbol1', 0x555);

  const linkerScript = new LinkerScript()
    .input(['obj1.o', 'obj2.o'])
    .memory([linkerScriptMemory1, linkerScriptMemory2, linkerScriptMemory3])
    .sections([linkerScriptSection1, linkerScriptSection2, linkerScriptSection3])
    .entry('bs_main')
  expect(linkerScript.toString()).toBe(`\
INPUT(obj1.o obj2.o)

MEMORY {
\tIRAM   (X)   : ORIGIN = 0x4000,  LENGTH = 150
\tDRAM   (WR)   : ORIGIN = 0x3000,  LENGTH = 150
\tEXTERNAL_SYMBOLS   (X)   : ORIGIN = 0x0,  LENGTH = 1000000000
}


SECTIONS {
\t.iram1 : {
\t\t. = ALIGN(4);
\t\tKEEP(obj1.o(.iram))
\t} > IRAM

\t.dram : {
\t\t. = ALIGN(4);
\t\tobj1.o(.dram .data*)
\t} > DRAM

\t.external_symbols : {
\t\tsymbol1 = 0x555;
\t} > EXTERNAL_SYMBOLS
}

ENTRY(bs_main)
`);
})