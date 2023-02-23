import { Node } from "@babel/types"
import Environment from "../visitor"
import type { StaticType } from "../types"

export class NameInfo {
  type: StaticType
  is_type_name: boolean

  constructor(t: StaticType) {
    this.type = t
    this.is_type_name = false
  }

  isTypeName(): boolean {
    return this.is_type_name
  }
}

// Name table

export interface NameTable extends Environment {
  record(key: string, t: StaticType): boolean
  lookup(key: string): NameInfo | undefined
  returnType(): StaticType | undefined | null
  setReturnType(t: StaticType): void
}

export class GlobalNameTable implements NameTable {
  names: Map<string, NameInfo>

  constructor() {
    this.names = new Map()
  }

  record(key: string, type: StaticType): boolean {
    const old = this.names.get(key)
    this.names.set(key, new NameInfo(type))
    return old === undefined
  }

  lookup(key: string): NameInfo | undefined {
    return this.names.get(key)
  }

  returnType(): StaticType | undefined | null {
    return null     // not in a function body.
  }

  setReturnType(t: StaticType): void {
    throw Error('cannot set a return type')
  }
}

export class BlockNameTable implements NameTable {
  names: {[key: string]: NameInfo}
  parent: NameTable

  constructor(parent: NameTable) {
    this.names = {}
    this.parent = parent
  }

  record(key: string, type: StaticType): boolean {
    const old = this.names[key]
    this.names[key] = new NameInfo(type)
    return old === undefined
  }

  lookup(key: string): NameInfo | undefined {
    const found = this.names[key]
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

export class FunctionNameTable extends BlockNameTable {
  thisReturnType: StaticType | undefined

  constructor(parent: NameTable) {
    super(parent)
    this.thisReturnType = undefined
  }

  returnType(): StaticType | undefined | null {
    return this.thisReturnType
  }

  setReturnType(t: StaticType): void {
    this.thisReturnType = t
  }
}

export function addNameTable(node: Node, nt: NameTable) {
  ((node as unknown) as { nameTable: NameTable }).nameTable = nt
}

export function getNameTable(node: Node) {
  return ((node as unknown) as { nameTable?: NameTable }).nameTable
}

export function addStaticType(node: Node, type: StaticType) {
  ((node as unknown) as { staticType: StaticType }).staticType = type
}

export function getStaticType(node: Node) {
  return ((node as unknown) as { staticType?: StaticType }).staticType
}
