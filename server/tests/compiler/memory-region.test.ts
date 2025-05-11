import {MemoryRegion, ReusableMemoryRegion} from "../../src/compiler/shadow-memory";
import {Section} from "../../src/compiler/elf-reader";
import {Buffer} from "node:buffer";

test('Test memory region.', () => {
  const memoryRegion = new MemoryRegion('DRAM', 0x3000, 150);

  // Allocate first block.
  const section1: Section = {name: '.data', address: 0x000, size: 32, value: Buffer.from([])};
  const memoryBlock1 = memoryRegion.allocate(section1);
  expect(memoryBlock1.address).toBe(0x3000);
  expect(memoryBlock1.size).toBe(32);
  expect(memoryBlock1.sectionName).toBe('.data');

  // Allocate second block
  const section2: Section = {name: '.data', address: 0x000, size: 100, value: Buffer.from([])};
  const memoryBlock2 = memoryRegion.allocate(section2);
  expect(memoryBlock2.address).toBe(0x3020);
  expect(memoryBlock2.size).toBe(100);
  expect(memoryBlock2.sectionName).toBe('.data');

  // Allocate third block.
  const section: Section = {name: '.data', address: 0x000, size: 50, value: Buffer.from([])};
  expect(() => {
    memoryRegion.allocate(section);
  }).toThrow();
});

test('Test reusable memory region', () => {
  const memoryRegion = new ReusableMemoryRegion('IRAM', 0x4000, 150);

  // Allocate 1st block.
  const section1: Section = {name: '.iram1', address: 0x000, size: 32, value: Buffer.from([])};
  const memoryBlock1 = memoryRegion.allocate(section1);
  expect(memoryBlock1.address).toBe(0x4000);
  expect(memoryBlock1.size).toBe(32);
  expect(memoryBlock1.sectionName).toBe('.iram1');

  // Allocate 2nd block
  const section2: Section = {name: '.iram2', address: 0x000, size: 100, value: Buffer.from([])};
  const memoryBlock2 = memoryRegion.allocate(section2);
  expect(memoryBlock2.address).toBe(0x4020);
  expect(memoryBlock2.size).toBe(100);
  expect(memoryBlock2.sectionName).toBe('.iram2');

  // Free 2nd block
  memoryRegion.free(memoryBlock2.sectionId || 0);

  // Allocate 3rd block
  const section3: Section = {name: '.iram3', address: 0x000, size: 50, value: Buffer.from([])};
  const memoryBlock3 = memoryRegion.allocate(section3);
  expect(memoryBlock3.address).toBe(0x4020);
  expect(memoryBlock3.size).toBe(52);
  expect(memoryBlock3.sectionName).toBe('.iram3');

  // Free 1st and 3rd block
  memoryRegion.free(memoryBlock1.sectionId || 0);
  memoryRegion.free(memoryBlock3.sectionId || 0);

  // Allocate 4th block
  const section4: Section = {name: '.iram4', address: 0x000, size: 140, value: Buffer.from([])};
  const memoryBlock4 = memoryRegion.allocate(section4);
  expect(memoryBlock4.address).toBe(0x4000);
  expect(memoryBlock4.size).toBe(140);
  expect(memoryBlock4.sectionName).toBe('.iram4');

  // Allocate 5th block
  const section5: Section = {name: '.iram5', address: 0x000, size: 50, value: Buffer.from([])};
  expect(() => {
    memoryRegion.allocate(section5);
  }).toThrow();
})

