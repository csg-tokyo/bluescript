import Environment from "../visitor";
import {BlockNameTable, FunctionNameTable, GlobalNameTable, NameTable} from "../type-checker/names";
import {isValueT} from "./gc";
import {GCArraySet, GCGlobalRootSetArray} from "./gc";


export interface RootSet extends Environment {
  nameTable: NameTable
  rootTable: {[name: string]: number};
  generateSetStatement(variableName: string):string;
  generateUpdateStatement(variableName: string): string;
}

export class GlobalRootSet implements RootSet {
  nameTable: GlobalNameTable
  rootTable: {[name: string]: number} = {}
  nextRootTableIndex:number;

  constructor(nameTable: GlobalNameTable) {
    this.nameTable = nameTable;
    let rootIndex = 0;
    for (const [name, info] of Object.entries(nameTable.names)) {
      if (isValueT(info.type)) {
        this.rootTable[name] = rootIndex;
        rootIndex++;
      }
    }
    this.nextRootTableIndex = rootIndex;
  }

  generateSetStatement(variableName: string):string {
    const index = this.rootTable[variableName];
    return `${GCArraySet}(${GCGlobalRootSetArray}, int_to_value(${index}), ${variableName})`;
  }

  generateUpdateStatement(variableName: string): string {
    return this.generateSetStatement(variableName)
  }
}

// TODO: 関数じゃないときもRootSetやるのか？
export class BlockRootSet implements RootSet {
  parent: RootSet;
  nameTable: BlockNameTable;
  rootTable: {[name: string]: number} = {};
  haveRootSet: boolean = false;

  constructor(parent: RootSet, nameTable: BlockNameTable) {
    this.parent = parent
    this.nameTable = nameTable

    let rootIndex = parent instanceof FunctionRootSet ? parent.numOfRootEntries() : 0;
    for (const [name, info] of Object.entries(nameTable.names)) {
      if (isValueT(info.type)) {
        this.rootTable[name] = rootIndex;
        rootIndex++;
      }
    }
  }

  generateInitStatement(): string {
    let numOfRootEntries = this.parent instanceof FunctionRootSet ? this.parent.numOfRootEntries() : 0;
    numOfRootEntries += Object.keys(this.rootTable).length
    if (numOfRootEntries === 0)
      return "";

    this.haveRootSet = true
    let s = `ROOT_SET(root_set, ${numOfRootEntries});\n`;
    if (this.parent instanceof FunctionRootSet) {
      for (const name of Object.keys(this.parent.rootTable)) {
        s += this.parent.generateSetStatement(name) + ";\n";
      }
    }
    return s;
  }

  generateSetStatement(variableName: string): string {
    const varIndex = this.rootTable[variableName];
    if (varIndex === undefined)
      return this.parent.generateSetStatement(variableName);
    return `root_set.values[${this.rootTable[variableName]}] = ${variableName}`
  }

  generateUpdateStatement(variableName: string): string {
    return this.generateSetStatement(variableName);
  }

  generateCleanUpStatement(): string {
    if (this.haveRootSet)
      return "DELETE_ROOT_SET(root_set);\n";
    return "";
  }
}

export class FunctionRootSet implements RootSet {
  parent: RootSet;
  nameTable: FunctionNameTable
  rootTable: {[name: string]: number} = {}

  constructor(parent:RootSet, nameTable: FunctionNameTable) {
    this.parent = parent;
    this.nameTable = nameTable;

    let rootIndex = 0;
    for (const [name, info] of Object.entries(nameTable.names)) {
      if (isValueT(info.type)) {
        this.rootTable[name] = rootIndex;
        rootIndex++;
      }
    }
  }

  numOfRootEntries(): number {
    return Object.keys(this.rootTable).length
  }

  generateSetStatement(variableName: string): string {
    const varIndex = this.rootTable[variableName];
    if (varIndex === undefined)
      return this.parent.generateSetStatement(variableName);
    return `root_set.values[${this.rootTable[variableName]}] = ${variableName}`
  }

  generateUpdateStatement(variableName: string): string {
    return this.generateSetStatement(variableName);
  }
}