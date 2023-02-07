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

export type DDSymbolAddresses = { [symbolName: string]: number };

export type DDSectionAddresses = {
  text: number,
  literal: number,
  data: number,
  rodata: number,
  bss: number
}

export type SectionName = "text" | "literal" | "data" | "rodata" | "bss";

export type LinkResult = {
  text: string,
  literal: string,
  data: string,
  rodata: string,
  bss: string,
  execFuncOffsets: number[]
}
