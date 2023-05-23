import OnetimeEnv from "./onetime-env";
import {EnvNewSymbol, envNewSymbolsToDBSymbols} from "../model/env-symbol";

export default class ReplEnv extends OnetimeEnv {
  newSymbols: {[name: string]: EnvNewSymbol} = {};
  execFuncNames: string[] = [];
  usedMemorySize: {[sectionName: string]: number} = {}

  setExecFuncNames(names: string[]) {
    this.execFuncNames = names;
  }

  setNewSymbols(symbols: EnvNewSymbol[]) {
    for (const symbol of symbols) {
      if (!symbol.name)
        continue;
      if (!this.newSymbols[symbol.name]) {
        this.newSymbols[symbol.name] = symbol;
      } else {
        this.newSymbols[symbol.name].type = symbol.type
      }
    }
  }

  setUsedMemorySize(sizes: {[name: string]: number}) {
    this.usedMemorySize = sizes;
  }

  setSymbolAddresses(addresses: {[name: string]: number}) {
    for (const [name, address] of Object.entries(addresses)) {
      if (this.newSymbols[name])
        this.newSymbols[name].address = address
    }
  }

  // TODO: 消す。
  getTextSectionBaseAddress(): number {
    const textSection = this.sections.filter(s => s.name === "text")[0];
    if (!textSection)
      throw Error("there is no text section.");
    return textSection.baseAddress;
  }


  // DBにsymbolsとsectionsの情報を保存。
  async store() {
    const newDBSymbols = envNewSymbolsToDBSymbols(Object.values(this.newSymbols));
    await this.symbolsTable.addSymbols(newDBSymbols);
    await this.sectionsTable.incrementAddresses(this.usedMemorySize);
  }
}