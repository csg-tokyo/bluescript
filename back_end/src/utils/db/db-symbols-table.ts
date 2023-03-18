import BaseTable from "./base-table";
import Constants from "../../constants";
import {DBSymbol} from "./model/db-symbol";

// TODO: nameで一意に保てるようにする。
export default class DBSymbolsTable extends BaseTable{

  constructor(dirPath: string) {
    const filePath = dirPath + Constants.SYMBOLS_TABLE_NAME;
    super(filePath);
  }

  public async addSymbols(symbols: DBSymbol[]):Promise<void> {
    const promises: Promise<void>[] = [];
    symbols.forEach(symbol => {
      promises.push(this.insert(symbol));
    });
    await Promise.all(promises);
  }

  public async getAllSymbols():Promise<DBSymbol[]> {
    return this.find({});
  }

  public async clear() {
    await this.remove({}, {multi: true});
  }
}
