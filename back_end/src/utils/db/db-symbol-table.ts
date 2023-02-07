import BaseTable from "./base-table";
import Constants from "../../constants";

export type DBSymbol = {
  name: string,
  address: number,
  declaration: string
  type: "function" | "variable"
}

export default class DBSymbolTable {
  private db: BaseTable;

  constructor(dirPath: string) {
    const filePath = dirPath + Constants.SYMBOLS_TABLE_NAME;
    this.db = new BaseTable(filePath)
  }

  public async getAllSymbols() {
    return await this.db.find({});
  }

  public async addSymbols(symbols: DBSymbol[]):Promise<void> {
    const promises: Promise<void>[] = [];
    symbols.forEach(symbol => {
      promises.push(this.addSymbol(symbol));
    });
    await Promise.all(promises);
  }

  public async addSymbol(symbol: DBSymbol):Promise<void> {
    await this.db.update(
      {name: symbol.name},
      {$set: symbol},
      {upsert: true});
  }

  public async getSymbol(name: string): Promise<DBSymbol | null> {
    const result = await this.db.find({name});
    return result.length ? result[0] : null;
  }

  public async clear() {
    await this.db.remove({}, {multi: true});
  }
}