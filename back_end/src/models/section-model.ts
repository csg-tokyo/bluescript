export const SectionNameArr = ["text", "literal", "data", "rodata", "bss"] as const;
export type SectionName = typeof SectionNameArr[number];

export type SectionModel = {
  name: SectionName,
  address: number,
  usedMemorySize: number
};