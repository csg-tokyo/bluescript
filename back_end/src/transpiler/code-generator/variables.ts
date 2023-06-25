import * as AST from '@babel/types'
import { Null, FunctionType, StaticType, isPrimitiveType } from '../types'
import { NameTable, NameTableMaker, GlobalNameTable,
         BlockNameTable, FunctionNameTable, NameInfo,
         getNameTable } from '../type-checker/names'
import { rootSetVariable } from './c-runtime'


function globalVariableName(varName: string, index?: number) {
  if (index === undefined)
    return `_${varName}`
  else
    return rootSetVariable(index, varName)
}

export class VariableInfo extends NameInfo {
  index?: number = undefined

  constructor(t: StaticType) {
    super(t)
  }

  // Name used for its declaration.
  // the returned value should be the same as the value
  // returned by transpile() when this.index === undefined.
  transpiledName(name: string) { return `_${name}` }

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
  private variableName: string = '??'
  private rootName?: string

  setVariableName(name: string, rootName?: string) {
    this.variableName = name
    this.rootName = rootName
  }

  transpiledName(name: string) { return `_${name}` }
  transpile(name: string) { return this.variableName }

  // name and type used for extern declaration
  externName(): [string, StaticType] {
      return this.rootName ? [this.rootName, Null] : [this.variableName, this.type]
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
  override makeFreeInfo(free: VariableInfo) {
    return new FreeVariableInfo(free)
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
      else if (!isPrimitiveType(info.type)) {
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

  getNumOfVars() { return this.numOfVars }

  override allocate() {
    const next = this.nextVar++
    if (this.numOfVars < this.nextVar)
      this.numOfVars = this.nextVar

    return next
  }

  override deallocate(num: number) { this.nextVar -= num }
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
        if (isPrimitiveType(info.type))
          info.setVariableName(globalVariableName(key))
        else if (info.type instanceof FunctionType)
          info.setVariableName(globalVariableName(key))
        else
          info.setVariableName(globalVariableName(this.rootset, num++), this.rootset)
      }
      else if (!(info instanceof FreeVariableInfo))
        throw new Error(`bad global info: ${key}, ${info.constructor.name}`)
    })
    return num
  }

  forEachExternalVariable(f: (name: string, type: StaticType) => void) {
    this.table.forEach((info, key) => {
      if (info instanceof FreeVariableInfo) {
        const origInfo = info.nameInfo
        if (origInfo instanceof GlobalVariableInfo) {
          const nameAndType = origInfo.externName()
          f(nameAndType[0], nameAndType[1])
        }
        else
          throw new Error(`bad external name info: ${key}, ${origInfo.constructor.name}`)
      }
    })
  }
}
