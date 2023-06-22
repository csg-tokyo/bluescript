import { Node } from '@babel/types'
import type { StaticType } from '../types'

// Elements of NameTable<T>

export class NameInfo {
  type: StaticType
  isTypeName: boolean
  isConst: boolean     // const or let
  isFunction: boolean  // top-level function
  captured: boolean    // captured by a lambda function

  constructor(t: StaticType) {
    this.type = t
    this.isTypeName = false
    this.isConst = false
    this.isFunction = false
    this.captured = false
  }

  copyFrom(info: NameInfo) {
    this.type = info.type
    this.isTypeName = info.isTypeName
    this.isConst = info.isConst
    this.isFunction = info.isFunction
    this.captured = info.captured
  }

  setup(f: (obj: this) => void) {
    f(this)
    return this
  }
}

// free-variable name
export class FreeNameInfo extends NameInfo {
  nameInfo: NameInfo

  constructor(name: NameInfo) {
    super(name.type)
    this.nameInfo = name
    this.isConst = name.isConst
    this.isFunction = name.isFunction
  }
}

// Name tables

// a factory for NameTable<T>
export interface NameTableMaker<Info extends NameInfo> {
  block(parent: NameTable<Info>): NameTable<Info>
  function(parent: NameTable<Info>): FunctionNameTable<Info>
  info(t: StaticType): Info
  globalInfo(t: StaticType): Info
}

export interface NameTable<Info extends NameInfo> {
  names(): {[key: string]: Info}      // debugging purpose only
  forEach(f: (value: Info, key: string) => void): void

  record(key: string, t: StaticType, maker: NameTableMaker<Info>,
         init?: (i: Info) => void): boolean
  lookup(key: string): Info | undefined
  returnType(): StaticType | undefined | null   // null if the table is for top-level
  setReturnType(t: StaticType): void
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

  record(key: string, t: StaticType, maker: NameTableMaker<Info>,
         init?: (i: Info) => void): boolean {
    const old = this.map.get(key)
    const info = maker.globalInfo(t)
    if (init !== undefined)
      init(info)

    this.map.set(key, info)
    return old === undefined
  }

  lookup(key: string): Info | undefined {
    const found = this.map.get(key)
    if (found === undefined) {
      // return this.parent?.lookup(key)
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

  abstract makeFreeInfo(free: Info): Info

  returnType(): StaticType | undefined | null {
    return null     // not in a function body.
  }

  setReturnType(t: StaticType): void {
    throw Error('cannot set a return type')
  }
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

  returnType(): StaticType | undefined | null {
    return this.parent.returnType()
  }

  setReturnType(t: StaticType): void {
    this.parent.setReturnType(t)
  }
}

export abstract class FunctionNameTable<Info extends NameInfo> extends BlockNameTable<Info> {
  thisReturnType: StaticType | undefined

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
        freeVariable.setup(_ => _.captured = true)
        const info = this.makeFreeInfo(freeVariable)
        this.elements[key] = info
        return info
      }
    }
    else
      return found
  }

  abstract makeFreeInfo(free: Info): Info

  returnType(): StaticType | undefined | null {
    return this.thisReturnType
  }

  setReturnType(t: StaticType): void {
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
}

class BasicFunctionNameTable extends FunctionNameTable<NameInfo> {
  override makeFreeInfo(free: NameInfo) {
    return new FreeNameInfo(free)
  }
}

export class BasicGlobalNameTable extends GlobalNameTable<NameInfo> {
  override makeFreeInfo(free: NameInfo) {
    return new FreeNameInfo(free)
  }
}
