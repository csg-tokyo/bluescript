export type ElfRelocation = {
  offset: number,
  symbolId: number,
  type: number,
  addEnd: number
}

export type ElfSymbol = {
  name: string,
  type: number,
  offset: number,
  residesSectionName: SectionName|null
}

export type SectionName = "text" | "literal" | "data" | "rodata" | "bss";
