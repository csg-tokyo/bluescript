// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import { Node } from '@babel/types'
import type { StaticType, ObjectType } from './types'
import { ClassTable, InstanceType } from './classes'

// Elements of NameTable<T>

export class NameInfo {
  type: StaticType
  isTypeName: boolean
  isConst: boolean     // const or let
  isFunction: boolean  // top-level function
  isExported: boolean
  captured: boolean    // captured as a free variable by a lambda function etc.

  constructor(t: StaticType) {
    this.type = t
    this.isTypeName = false
    this.isConst = false
    this.isFunction = false
    this.isExported = false
    this.captured = false
  }

  copyFrom(info: NameInfo) {
    this.type = info.type
    this.isTypeName = info.isTypeName
    this.isConst = info.isConst
    this.isFunction = info.isFunction
    this.isExported = info.isExported
    // this.captured = info.captured
  }

  setup(f: (obj: this) => void) {
    f(this)
    return this
  }
}

// Free-variable name.
// This class is instantiated only when BasicNameTableMaker is used.
// see FreeVariableInfo.
export class FreeNameInfo extends NameInfo {
  nameInfo: NameInfo

  constructor(name: NameInfo) {
    super(name.type)
    this.copyFrom(name)
    while (name instanceof FreeNameInfo)
      name = name.nameInfo

    this.nameInfo = name
  }
}

// Name tables

// a factory for NameTable<T>
export interface NameTableMaker<Info extends NameInfo> {
  block(parent: NameTable<Info>): NameTable<Info>
  function(parent: NameTable<Info>): FunctionNameTable<Info>
  info(t: StaticType): Info
  globalInfo(t: StaticType): Info
  instanceType(name: string, superClass: ObjectType): InstanceType
}

export interface NameTable<Info extends NameInfo> {
  names(): {[key: string]: Info}      // debugging purpose only
  forEach(f: (value: Info, key: string) => void): void

  record(key: string, t: StaticType, maker: NameTableMaker<Info>,
         init?: (i: Info) => void): boolean
  lookup(key: string): Info | undefined
  lookupInThis(key: string): Info | undefined
  returnType(): StaticType | undefined | null   // null if the table is for top-level
  setReturnType(t: StaticType): void
  isGlobal(): boolean       // true if the table is for top-level
  classTable(): ClassTable
}

export abstract class GlobalNameTable<Info extends NameInfo> implements NameTable<Info> {
  map: Map<string, Info>
  parent?: NameTable<Info>

  constructor(parent?: NameTable<Info>) {
    this.map = new Map()
    this.parent = parent
  }

  names() {
    const entries: {[key: string]: Info} = {}
    this.map.forEach((value, key, map) => {
      entries[key] = value
    })

    return entries
  }

  forEach(f: (value: Info, key: string) => void): void {
    this.map.forEach(f)
  }

  // It does not record a name if the name is already recorded
  // in a parent NameTable.
  record(key: string, t: StaticType, maker: NameTableMaker<Info>,
         init?: (i: Info) => void): boolean {
    const old = this.lookup(key)
    const info = maker.globalInfo(t)
    if (init !== undefined)
      init(info)

    this.map.set(key, info)
    return old === undefined
  }

  importInfo(key: string, info: Info) {
    const finfo = this.makeFreeInfo(info)
    this.map.set(key, finfo)
  }

  // When it finds a name in a parent NameTable,
  // it will add a FreeNameInfo object to its table.
  lookup(key: string): Info | undefined {
    const found = this.map.get(key)
    if (found === undefined) {
      const freeVariable = this.parent?.lookup(key)
      if (freeVariable === undefined)
        return undefined
      else {
        const info = this.makeFreeInfo(freeVariable)
        this.map.set(key, info)
        return info
      }
    }
    else
      return found
  }

  lookupInThis(key: string): Info | undefined {
    return this.map.get(key)
  }

  abstract makeFreeInfo(free: Info): Info

  returnType(): StaticType | undefined | null {
    return null     // not in a function body.
  }

  setReturnType(t: StaticType): void {
    throw Error('cannot set a return type')
  }

  isGlobal() { return true }

  abstract classTable(): ClassTable
}

export class BlockNameTable<Info extends NameInfo> implements NameTable<Info> {
  elements: {[key: string]: Info}
  parent: NameTable<Info>

  constructor(parent: NameTable<Info>) {
    this.elements = {}
    this.parent = parent
  }

  names() { return this.elements }

  forEach(f: (value: Info, key: string) => void) {
    for (const k in this.elements)
      f(this.elements[k], k)
  }
 
  record(key: string, t: StaticType, maker: NameTableMaker<Info>,
         init?: (i: Info) => void): boolean {
    const old = this.elements[key]
    const info = maker.info(t)
    if (init !== undefined)
      init(info)

    this.elements[key] = info
    return old === undefined
  }

  lookup(key: string): Info | undefined {
    const found = this.elements[key]
    if (found === undefined)
      return this.parent.lookup(key)
    else
      return found
  }

  lookupInThis(key: string): Info | undefined {
    return this.elements[key]
  }

  returnType(): StaticType | undefined | null {
    return this.parent.returnType()
  }

  setReturnType(t: StaticType): void {
    this.parent.setReturnType(t)
  }

  isGlobal() { return false }

  classTable() { return this.parent.classTable() }
}

export abstract class FunctionNameTable<Info extends NameInfo> extends BlockNameTable<Info> {
  private thisReturnType: StaticType | undefined

  constructor(parent: NameTable<Info>) {
    super(parent)
    this.thisReturnType = undefined
  }

  lookup(key: string): Info | undefined {
    const found = this.elements[key]
    if (found === undefined) {
      const freeVariable = this.parent.lookup(key)
      if (freeVariable === undefined)
        return undefined
      else {
        if (!this.parent.isGlobal())
          freeVariable.setup(_ => _.captured = true)
        const info = this.makeFreeInfo(freeVariable)
        this.elements[key] = info
        return info
      }
    }
    else
      return found
  }

  abstract makeFreeInfo(free: Info): Info     // make a free variable name
  abstract isFreeInfo(free: Info): boolean    // true if it is a free variable name

  returnType(): StaticType | undefined {
    return this.thisReturnType
  }

  setReturnType(t: StaticType | undefined): void {
    this.thisReturnType = t
  }
}

export function addNameTable<Info extends NameInfo>(node: Node, st: NameTable<Info>) {
  ((node as unknown) as { symbolTable: NameTable<Info> }).symbolTable = st
}

export function getNameTable<Info extends NameInfo>(node: Node) {
  return ((node as unknown) as { symbolTable?: NameTable<Info> })?.symbolTable
}

export function addStaticType(node: Node, type: StaticType) {
  ((node as unknown) as { staticType: StaticType }).staticType = type
}

export function getStaticType(node: Node) {
  return ((node as unknown) as { staticType?: StaticType }).staticType
}

export function addCoercionFlag(node: Node, flag: boolean) {
  ((node as unknown) as { coercion: boolean }).coercion = flag
}

export function getCoercionFlag(node: Node) {
  return ((node as unknown) as { coercion: boolean }).coercion
}

// utility classes for running a type checker with NameTable<NameInfo>

export class BasicNameTableMaker implements NameTableMaker<NameInfo> {
  block(parent: NameTable<NameInfo>) { return new BlockNameTable<NameInfo>(parent) }
  function(parent: NameTable<NameInfo>) { return new BasicFunctionNameTable(parent) }
  info(t: StaticType) { return new NameInfo(t) }
  globalInfo(t: StaticType) { return new NameInfo(t) }
  instanceType(name: string, superClass: ObjectType) { return new InstanceType(name, name, superClass) }
}

class BasicFunctionNameTable extends FunctionNameTable<NameInfo> {
  override makeFreeInfo(free: NameInfo) {
    return new FreeNameInfo(free)
  }
  isFreeInfo(free: NameInfo): boolean { return free instanceof FreeNameInfo }
}

export class BasicGlobalNameTable extends GlobalNameTable<NameInfo> {
  private classTableObject?: ClassTable

  constructor(parent?: NameTable<NameInfo>) {
    super(parent)
    if (parent)
      this.classTableObject = undefined
    else
      this.classTableObject = new ClassTable()
  }

  override makeFreeInfo(free: NameInfo) {
    return new FreeNameInfo(free)
  }

  override classTable(): ClassTable {
    if (this.classTableObject)
      return this.classTableObject
    else
      return this.classTable()
  }
}
