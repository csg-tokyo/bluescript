import Environment from "../visitor";
import {BlockNameTable, FunctionNameTable, GlobalNameTable, NameTable} from "../type-checker/names";
import {StaticType} from "../types";

// GC function, object names
export const GCGlobalRootSetArray = "global_root_set_array";
export const GCNewString = "gc_new_string";
export const GCArraySet = "gc_array_set"; // value_t gc_array_set(value_t obj, value_t index, value_t new_value)


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

  constructor(nameTable: GlobalNameTable, nextRootTableIndex: number = 0) {
    this.nameTable = nameTable;
    this.nextRootTableIndex = nextRootTableIndex;
  }

  generateSetStatement(variableName: string):string {
    const varType = this.nameTable.lookup(variableName)?.type;
    if (varType !== undefined && !isValueT(varType))
      return "";

    const s = `${GCArraySet}(${GCGlobalRootSetArray}, int_to_value(${this.nextRootTableIndex}), ${variableName})`;
    this.rootTable[variableName] = this.nextRootTableIndex;
    this.nextRootTableIndex++;
    return s;
  }

  generateUpdateStatement(variableName: string): string {
    const varType = this.nameTable.lookup(variableName)?.type;
    if (varType !== undefined && !isValueT(varType))
      return "";

    const index = this.rootTable[variableName];
    return `${GCArraySet}(${GCGlobalRootSetArray}, int_to_value(${index}), ${variableName})`;
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
    const varType = this.nameTable.lookup(variableName)?.type;
    if (varType !== undefined && !isValueT(varType))
      return "";

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
    const varType = this.nameTable.lookup(variableName)?.type;
    if (varType !== undefined && !isValueT(varType))
      return "";

    const varIndex = this.rootTable[variableName];
    if (varIndex === undefined)
      return this.parent.generateSetStatement(variableName);
    return `root_set.values[${this.rootTable[variableName]}] = ${variableName}`
  }

  generateUpdateStatement(variableName: string): string {
    return this.generateSetStatement(variableName);
  }
}

export function isValueT(t: StaticType): boolean {
  const noValueT: any[] = ["integer", "float", "boolean", "void", "null"]
  return !noValueT.includes(t);
}