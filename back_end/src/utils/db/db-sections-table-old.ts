import BaseTable from "./base-table";
import Constants from "../../constants";

export type DBSection = {
  name: "text" | "literal" | "data" | "rodata" | "bss",
  address: number,
  usedMemorySize: number
}

export default class DbSectionsTableOld {
  private db: BaseTable;

  constructor(dirPath: string) {
    const filePath = dirPath + Constants.SECTIONS_TABLE_NAME;
    this.db = new BaseTable(filePath);
  }

  public async getAllSections():Promise<DBSection[]> {
    const result = await this.db.find({});
    if (result.length !== 5) {
      throw new Error("Something wrong happened with section db.");
    }
    return result;
  }

  public async addSections(sections: DBSection[]): Promise<void> {
    const promises: Promise<void>[] = [];
    sections.forEach(section => {
      promises.push(this.addSection(section));
    });
    await Promise.all(promises);
  }

  public async incrementAllUsedMemory(sizes: { text: number, literal: number, data: number, rodata: number, bss: number }) {
    await Promise.all([
      this.incrementUsedMemorySize("text", sizes.text),
      this.incrementUsedMemorySize("literal", sizes.literal),
      this.incrementUsedMemorySize("data", sizes.data),
      this.incrementUsedMemorySize("rodata",sizes.rodata),
      this.incrementUsedMemorySize("bss", sizes.bss)
    ])
  }

  public async getSectionData(name: string): Promise<DBSection> {
    return (await this.db.find({name}))[0];
  }

  public async addSection(section: DBSection): Promise<void> {
    await this.db.update(
      {name: section.name},
      {$set: section},
      {upsert: true});
  }

  public async incrementUsedMemorySize(name: string, size: number) {
    await this.db.update(
      {name},
      {$inc: {usedMemorySize: size}},
      {}
    )
  }

  public async clear() {
    await this.db.remove({}, {multi: true});
  }
}