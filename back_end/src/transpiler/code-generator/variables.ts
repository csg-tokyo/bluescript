import * as AST from '@babel/types'
import { StaticType, isPrimitiveType } from '../types'
import { NameTable, NameTableMaker, GlobalNameTable, 
         BlockNameTable, FunctionNameTable, NameInfo,
         getNameTable } from '../type-checker/names'


export function rootSetVariable(index: number | undefined) {
  return `_func_rootset.values[${index}]`
}

function globalVariableName(name: string | undefined) {
  if (name === undefined)
    throw new Error('a global variable name is undefined')
  else
    return name
}

export class VariableInfo extends NameInfo {
  index?: number = undefined

  constructor(t: StaticType) {
    super(t)
  }

  transpile() { return rootSetVariable(this.index) }
}
  
class FreeVariableInfo extends VariableInfo {
  nameInfo: NameInfo
  variableName?: string
  
  constructor(name: NameInfo) {
    super(name.type)
    this.nameInfo = name
  }

  transpile() { return globalVariableName(this.variableName) }
}

// to customize TypeChecker to use VariableInfo instead of NameInfo
export class VariableTableMaker implements NameTableMaker<VariableInfo> {
  global() { return new GlobalNameTable<VariableInfo>() }
  block(parent: NameTable<VariableInfo>) { return new BlockNameTable<VariableInfo>(parent) }
  function(parent: NameTable<VariableInfo>) { return new FunctionVarTable(parent) }
  info(t: StaticType) { return new VariableInfo(t) }
}

class FunctionVarTable extends FunctionNameTable<VariableInfo> {
  override makeFreeInfo(free: NameInfo) {
    return new FreeVariableInfo(free)
  }
}

export function getVariableTable(node: AST.Node) {
  const vt = getNameTable<VariableInfo>(node)
  if (vt === undefined)
    throw new Error(`a symbol table is not available ${node}`)
  else
    return vt
}

// Variable Environment
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
        info.variableName = key
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
    if (next <= this.numOfVars)
      this.numOfVars++

    return next
  }

  override deallocate(num: number) { this.nextVar -= num }
}
  
export class CodeWriter {
  static indentSpaces = ['', '  ', '    ', '      ']
  code = ''
  indentLevel = 0

  copy() {
    const writer = new CodeWriter()
    writer.indentLevel = this.indentLevel
    return writer
  }

  getCode() { return this.code }

  write(text: string) {
    this.code += text
    return this
  }

  right() {
    this.indentLevel++
    if (this.indentLevel >= CodeWriter.indentSpaces.length)
      this.indentLevel = CodeWriter.indentSpaces.length - 1

    return this
  }

  left() {
    this.indentLevel--
    if (this.indentLevel < 0)
      this.indentLevel = 0

    return this
  }

  nl() {    // new line
    this.code += '\n'
    const level = this.indentLevel
    this.code += CodeWriter.indentSpaces[level]
    return this
  }
}
