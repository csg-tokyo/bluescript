import {Buffer} from "node:buffer";
import {ElfRelocation} from "./models";
import {SectionName} from "../models/section-model";
import LinkStrategy from "./link-strategy";

export default class SectionValue {
  sectionName: SectionName;
  relocations: ElfRelocation[];
  value: Buffer;

  constructor(sectionName: SectionName, relocations: ElfRelocation[], value: Buffer) {
    this.sectionName = sectionName;
    this.relocations = relocations;
    this.value = value;
  }

  getLinkedValue(strategy: LinkStrategy):Buffer {
    return strategy.link(this.sectionName, this.value, this.relocations);
  }

  public getSize(): number{
    return this.value.length;
  }
}