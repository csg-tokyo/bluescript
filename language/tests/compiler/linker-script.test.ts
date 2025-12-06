import { describe, expect, it } from '@jest/globals';
import { ShadowMemory } from '../../src/compiler/compiler';
import generateLinkerScript from '../../src/compiler/linker-script';

describe('generateLinkerScript', () => {

  const mockShadowMemory: ShadowMemory = {
    iram: { name: '.iram', address: 0x40080000, size: 10000, used:0 },
    dram: { name: '.dram', address: 0x3FFB0000, size: 10000, used:0 },
    iflash: { name: '.iflash', address: 0x400D0000, size: 1000, used:0 },
    dflash: { name: '.dflash', address: 0x3F400000, size: 1000, used:0 },
  };

  it('should generate a correct linker script with all parameters provided', () => {
    const inputFiles = ['liba.a', 'libc.a', 'main.o', 'utils.o'];
    const definedSymbols = [
      { name: 'defined_func1', address: 0x12345678 },
      { name: 'defined_val1', address: 0x87654321 },
    ];
    const entryPointName = 'bluescript_main0_';
    const subModuleEntryPoints = ['bluescript_main1_0', 'bluescript_main2_0'];

    const script = generateLinkerScript(
      inputFiles,
      mockShadowMemory,
      definedSymbols,
      entryPointName,
      subModuleEntryPoints
    );

    expect(script).toMatchSnapshot();
  });
});