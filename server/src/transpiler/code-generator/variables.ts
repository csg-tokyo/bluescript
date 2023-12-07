// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { Null, FunctionType, StaticType, isPrimitiveType } from '../types'
import { NameTable, NameTableMaker, GlobalNameTable,
         BlockNameTable, FunctionNameTable, NameInfo,
         getNameTable } from '../names'
import { ClassTable, InstanceType } from '../classes'
import { rootSetVariable } from './c-runtime'

export class VariableInfo extends NameInfo {
  index?: number = undefined

  constructor(t: StaticType) {
    super(t)
  }

  // Name used for its declaration
  // the returned value should be the same as the value
  // returned by transpile() when this.index === undefined.
  transpiledName(name: string) { return `_${name}` }

  // The expression to obtian the value of this variable.
  transpile(name: string) {
    if (this.index === undefined)
      return `_${name}`
    else
      return rootSetVariable(this.index)
  }
}

class FreeVariableInfo extends VariableInfo {
  nameInfo: VariableInfo
  
  constructor(name: VariableInfo) {
    super(name.type)
    this.copyFrom(name)
    while (name instanceof FreeVariableInfo)
      name = name.nameInfo

    this.nameInfo = name
  }

  transpiledName(name: string) { return this.nameInfo.transpiledName(name) }
  transpile(name: string) { return this.nameInfo.transpile(name) }
}

class GlobalVariableInfo extends VariableInfo {
  private rootSetName?: string

  override transpile(name: string) {
    if (this.rootSetName)
      return rootSetVariable(this.index, this.rootSetName)
    else
      return super.transpile(name)
  }

  // set a rootset name and a rootset index
  setIndex(varName: string, index: number) {
    this.rootSetName = varName
    this.index = index
  }

  // name and type used for extern declaration
  externName(name: string): [string?, StaticType?] {
    if (this.isTypeName)
      return [undefined, this.type]
    else
      return this.rootSetName ? [this.rootSetName, undefined] : [this.transpile(name), this.type]
  }
}

// A variable name table refers to NameTable<VariableInfo>.

// to customize TypeChecker to use VariableInfo instead of NameInfo
export class VariableNameTableMaker implements NameTableMaker<VariableInfo> {
  block(parent: NameTable<VariableInfo>) { return new BlockNameTable<VariableInfo>(parent) }
  function(parent: NameTable<VariableInfo>) { return new FunctionVarNameTable(parent) }
  info(t: StaticType) { return new VariableInfo(t) }
  globalInfo(t: StaticType) { return new GlobalVariableInfo(t) }
}

class FunctionVarNameTable extends FunctionNameTable<VariableInfo> {
  override makeFreeInfo(free: VariableInfo) {
    return new FreeVariableInfo(free)
  }

  isFreeInfo(free: NameInfo): boolean { return free instanceof FreeVariableInfo }
}

export class GlobalVariableNameTable extends GlobalNameTable<VariableInfo> {
  private classTableObject?: ClassTable

  constructor(parent?: NameTable<VariableInfo>) {
    super(parent)
    if (parent)
      this.classTableObject = undefined
    else
      this.classTableObject = new ClassTable()
  }

  override makeFreeInfo(free: VariableInfo) {
    return new FreeVariableInfo(free)
  }

  override classTable(): ClassTable {
    if (this.classTableObject)
      return this.classTableObject
    else if (this.parent)
      return this.parent.classTable()
    else
      throw new Error('fatal: not class table found')
  }
}

export function getVariableNameTable(node: AST.Node): NameTable<VariableInfo> {
  const vt = getNameTable<VariableInfo>(node)
  if (vt === undefined)
    throw new Error(`a symbol table is not available ${node}`)
  else
    return vt
}

// Variable Environment.

// This mainly manages memory allocation for local/global variables,
// in particular, when a variable is allocated in a local root set.
// It is a wrapper for NameTable<VariableInfo>.
export class VariableEnv {
  table: NameTable<VariableInfo>
  parent: VariableEnv | null

  constructor(table: NameTable<VariableInfo>, parent: VariableEnv | null) {
    this.table = table
    this.parent = parent
  }

  // returnType() returns null if this represents top-level.
  returnType(): StaticType | undefined | null {
    return this.table.returnType()
  }

  getNumOfVars(): number {
    if (this.parent)
      return this.parent.getNumOfVars()
    else
      throw new Error('cannot getNumOfVars')
  }

  allocate(): number {
    if (this.parent !== null)
      return this.parent.allocate()
    else
      throw new Error('cannot allocate')
  }

  deallocate(num: number) {
    this.parent?.deallocate(num)
  }

  allocateRootSet() {
    let num = 0
    this.table.forEach((info, key) => {
      if (info instanceof FreeVariableInfo) {
        // do nothing
      }
      else if (!info.isTypeName && !isPrimitiveType(info.type)) {
        // ObjectType or FunctionType
        info.index = this.allocate()
        num++
      }
    })
    return num
  }
}

export class FunctionEnv extends VariableEnv {
  numOfVars: number   // number of variables in the root set
  nextVar: number     // the next allocatable variable

  constructor(table: NameTable<VariableInfo>, parent: VariableEnv | null) {
    super(table, parent)
    this.numOfVars = 0
    this.nextVar = 0
  }

  override getNumOfVars() { return this.numOfVars }

  override allocate() {
    const next = this.nextVar++
    if (this.numOfVars < this.nextVar)
      this.numOfVars = this.nextVar

    return next
  }

  override deallocate(num: number) { this.nextVar -= num }

  isFreeVariable(info: VariableInfo | undefined) {
    return info instanceof FreeVariableInfo
  }
}

export class GlobalEnv extends FunctionEnv {
  rootset: string

  constructor(table: NameTable<VariableInfo>, rootset: string) {
    super(table, null)
    this.rootset = rootset
  }

  override allocateRootSet() {
    let num = 0
    this.table.forEach((info, key) => {
      if (info instanceof GlobalVariableInfo) {
        if (isPrimitiveType(info.type)
            || (info.isFunction && info.type instanceof FunctionType)
            || (info.isTypeName && info.type instanceof InstanceType)) {
          // do nothing
        }
        else
          info.setIndex(this.rootset, num++)
      }
      else if (!(info instanceof FreeVariableInfo))
        throw new Error(`bad global info: ${key}, ${info.constructor.name}`)
    })
    return num
  }

  // For a variable stored in a root set, undefined is given to f as the 2nd argument.
  // For a type name, undefined is given to f as the 1st argument.
  forEachExternalVariable(f: (name?: string, type?: StaticType) => void) {
    this.table.forEach((info, key) => {
      if (info instanceof FreeVariableInfo) {
        const origInfo = info.nameInfo
        if (origInfo instanceof GlobalVariableInfo) {
          const nameAndType = origInfo.externName(key)
          f(nameAndType[0], nameAndType[1])
        }
        else
          throw new Error(`bad external name info: ${key}, ${origInfo.constructor.name}`)
      }
    })
  }
}
