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
  residesSectionName: string | null
}
