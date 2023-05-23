import DBSymbolsTable from "../../utils/db/db-symbols-table";
import DeviceData from "./device-data";
import {EnvSymbol, dbSymbolsToEnvSymbols} from "../model/env-symbol";
import {EnvSection} from "../model/env-section";
import * as fs from 'fs';
import CONSTANTS from "../../constants";
import {DBSymbol} from "../../utils/db/model/db-symbol";
import DBSectionsTable from "../../utils/db/db-sections-table";
import {StaticType} from "../../transpiler/types";

export default class OnetimeEnv {
  sectionsTable: DBSectionsTable
  symbolsTable: DBSymbolsTable

  symbols: EnvSymbol[] = [];
  sections: EnvSection[] = [];

  constructor(tableDir: string) {
    this.sectionsTable = new DBSectionsTable(tableDir);
    this.symbolsTable = new DBSymbolsTable(tableDir);
  }

  // DBからsymbolsとsectionsのデータを読み込む。
  async load(initTable:boolean = true) {
    if (initTable)
      await this.initTable();
    this.sections = await this.sectionsTable.getAllSections();
    const dbSymbols = await this.symbolsTable.getAllSymbols();
    this.symbols = dbSymbolsToEnvSymbols(dbSymbols);
  }

  getSymbolTypes(): {name: string, type: StaticType}[] {
    const result:{name: string, type: StaticType}[] = [];
    for (const symbol of this.symbols) {
      if (symbol.type)
        result.push({name: symbol.name, type: symbol.type});
    }
    return result;
  }

  getSymbolDeclarations(): string[] {
    return this.symbols.map(s => s.cDeclaration);
  }

  getSymbolAddresses(): {[name: string]: number} {
    const result:{[name: string]: number} = {};
    for (const symbol of this.symbols) {
        result[symbol.name] = symbol.address;
    }
    return result;
  }

  getSectionAddresses(): {[name: string]: number} {
    const result:{[name: string]: number} = {};
    for (const symbol of this.sections) {
      result[symbol.name] = symbol.address;
    }
    return result;
  }

  // 環境の初期化
  async initTable() {
    const deviceData = new DeviceData();
    // sections
    const dbSections = deviceData.getSections();
    await this.sectionsTable.clear();
    await this.sectionsTable.addSections(dbSections);
    // symbols
    let dbSymbols:DBSymbol[] = JSON.parse(fs.readFileSync(CONSTANTS.SYMBOLS_INITIAL_DATA_JSON_PATH, "utf-8"));
    const addresses: {[name: string]: number} = deviceData.getSymbolAddresses(dbSymbols.map(x=>x.name));
    dbSymbols = dbSymbols.map(s => {
      s.address = addresses[s.name];
      return s;
    });
    await this.symbolsTable.clear();
    await this.symbolsTable.addSymbols(dbSymbols);
  }
}