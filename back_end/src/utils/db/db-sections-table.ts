import BaseTable from "./base-table"
import {SectionModel, SectionName} from "../../models/section-model";
import Constants from "../../constants";


export default class DBSectionsTable extends BaseTable{

  constructor(dirPath: string) {
    const filePath = dirPath + Constants.SECTIONS_TABLE_NAME;
    super(filePath);
  }

  public async initSections(sections: SectionModel[]): Promise<void> {
    await this.clear();
    const promises: Promise<void>[] = [];
    sections.forEach(section => {
      return promises.push(this.insert(section));
    });
    await Promise.all(promises);

  }

  public async getAllSections():Promise<SectionModel[]> {
    return this.find({});
  }

  public async getSectionAddress(name:string):Promise<number> {
    const section = await this.find({name});
    if (!section.length || !section[0].address) {
      throw Error("Could not find the section. section name is " + name);
    }
    return section[0].address;
  }

  public async incrementAllUsedMemory(sizes: {[name:string]: number}) {
    const promises: Promise<void>[] = []
    for (const [name, size] of Object.entries(sizes)) {
      promises.push(this.incrementUsedMemorySize(name, size))
    }
    await Promise.all(promises);
  }

  private async incrementUsedMemorySize(name: string, size: number) {
    await this.update(
      {name},
      {$inc: {usedMemorySize: size}},
      {}
    )
  }

  private async clear() {
    await this.remove({}, {multi: true});
  }
}