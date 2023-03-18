import Constants from "../../constants";
import BaseTable from "./base-table";
import {DBSection} from "./model/db-section";

export default class DBSectionsTable extends BaseTable {
  constructor(dirPath: string) {
    const filePath = dirPath + Constants.SECTIONS_TABLE_NAME;
    super(filePath);
  }

  public async addSections(symbols: DBSection[]): Promise<void> {
    const promises: Promise<void>[] = [];
    symbols.forEach(symbol => {
      promises.push(this.insert(symbol));
    });
    await Promise.all(promises);
  }

  public async getAllSections(): Promise<DBSection[]> {
    return this.find({});
  }

  async incrementAddresses(usedMemorySizes: {[sectionName: string]: number}) {
    const promises: Promise<void>[] = []
    for (const [name, size] of Object.entries(usedMemorySizes)) {
      promises.push(this.incrementAddress(name, size))
    }
    await Promise.all(promises);
  }

  private async incrementAddress(name: string, size: number) {
    await this.update(
      {name},
      {$inc: {address: size}},
      {}
    )
  }

  public async clear() {
    await this.remove({}, {multi: true});
  }
}
