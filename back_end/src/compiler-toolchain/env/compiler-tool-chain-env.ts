import * as fs from 'fs';

import DeviceData from "./device-data";
import DBSectionsTable from "../../utils/db/db-sections-table";
import DBSymbolsTable from "../../utils/db/db-symbols-table";
import CONSTANTS from "../../constants";
import {FunctionTypeModel, SymbolModel, VariableTypeModel} from "../../models/symbol-model";


export default class CompilerToolChainEnv {
  private sectionsTable: DBSectionsTable
  private symbolsTable: DBSymbolsTable
  private deviceData: DeviceData

  private newDefinedSymbols: SymbolModel[] = [];
  private sectionUsedMemorySizes: {[key:string]: number} = {}

  constructor(tableDir: string) {
    this.symbolsTable = new DBSymbolsTable(tableDir);
    this.sectionsTable = new DBSectionsTable(tableDir);
    this.deviceData = new DeviceData()
  }

  // 環境の初期化
  // TODO: symbols-initial-data.jsonのチェックシステムを作る。
  public async initialize() {
    // init sections
    const sections = this.deviceData.getSections();
    await this.sectionsTable.initSections(sections);
    // init symbols
    await this.symbolsTable.clear();
    let symbols:SymbolModel[] = JSON.parse(fs.readFileSync(CONSTANTS.SYMBOLS_INITIAL_DATA_JSON_PATH, "utf-8"));
    const symbolAddresses = this.deviceData.getSymbolAddresses(symbols.map(symbol => symbol.name));
    symbols = symbols.map(symbol => {
      symbol.address = symbolAddresses[symbol.name];
      return symbol;
    });
    await this.symbolsTable.addSymbols(symbols);
  }

  public async generatePublicSymbolTypes():Promise<{[name: string]: VariableTypeModel | FunctionTypeModel}> {
    const publicSymbols = await this.symbolsTable.getPublicSymbols();
    const result:{[name: string]: VariableTypeModel | FunctionTypeModel} = {}
    publicSymbols.forEach(symbol => {
      if (!symbol.type || !symbol.name) {
        throw Error("There is a symbol without type. the symbol is " + symbol);
      }
      result[symbol.name] = symbol.type;
    });
    return result;
  }

  public async generateSymbolDeclarations():Promise<{symbolType: "variable"|"function", declaration: string}[]> {
    const symbols = await this.symbolsTable.getAllSymbols();
    const result:{symbolType: "variable"|"function", declaration:string}[] = [];
    symbols.forEach(symbol => {
      if (!symbol.type || !symbol.declaration) {
        throw Error("There is a symbol without declaration or type. the symbol is " + symbol);
      }
      result.push({symbolType: symbol.type.symbolType, declaration: symbol.declaration});
    });
    return result;
  }

  public async generateSectionStartAddresses(): Promise<{[name:string]: number}> {
    const sections = await this.sectionsTable.getAllSections();
    const result:{[name:string]: number} = {};
    sections.forEach(section => {
      result[section.name] = section.address + section.usedMemorySize;
    });
    return result;
  }

  public async generateSymbolAddresses(): Promise<{[name:string]: number}> {
    const symbols = await this.symbolsTable.getAllSymbols();
    const result:{[name:string]: number} = {};
    symbols.forEach(symbol => {
      if (!symbol.name || !symbol.address) {
        throw Error("There is a symbol without address. the symbol is " + JSON.stringify(symbol));
      }
      result[symbol.name] = symbol.address;
    });
    return result;
  }

  public async generateTextSectionAddress():Promise<number> {
    return this.sectionsTable.getSectionAddress("text");
  }

  public setNewDefinedSymbols(symbols: SymbolModel[]) {
    this.newDefinedSymbols = symbols;
  }

  public setNewDefinedSymbolAddresses(addresses: {[name: string]: number}) {
    this.newDefinedSymbols.forEach(symbol => {
      if (!addresses[symbol.name]) {
        throw Error("There is a symbol which does not have the address.");
      }
      symbol.address = addresses[symbol.name];
    });
  }

  public setSectionUsedMemorySizes(sizes: {[name:string]: number}) {
    this.sectionUsedMemorySizes = sizes;
  }

  public async storeNewDataToDB() {
    await this.symbolsTable.addSymbols(this.newDefinedSymbols);
    if (!this.sectionUsedMemorySizes) {
      throw Error("The used memory size should be set.");
    }
    await this.sectionsTable.incrementAllUsedMemory(this.sectionUsedMemorySizes);
  }
}