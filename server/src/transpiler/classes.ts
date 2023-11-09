// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { ObjectType, StaticType } from "./types"

// Type for instances of a class
export class InstanceType extends ObjectType {
  private properties: { [key: string]: [StaticType, number] } = {}
  private numOfProperties = 0
  private superClass: ObjectType
  private className: string

  constructor(name: string, superClass: ObjectType) {
    super()
    this.superClass = superClass
    this.className = name
  }

  name() { return this.className }

  superType(): ObjectType | null { return this.superClass }

  forEach(f: (n: string, t: StaticType, i: number) => void) {
    for (const name in this.properties) {
      const value = this.properties[name]
      f(name, value[0], value[1])
    }
  }

  forEachName(f: (n: string) => void) {
    for (const name in this.properties)
      f(name)
  }

  addProperty(name: string, type: StaticType) {
    const success = !this.properties[name]
    this.properties[name] = [type, this.numOfProperties++]
    return success
  }

  findProperty(name: string) {
    return this.properties[name]
  }
}

export class ClassTable {
  private methodNames = new Map<string, number>()
  private numOfMethods = 0

  // clazz must be added after all properties and methods are
  //   added to it.
  addClass(name: string, clazz: InstanceType) {
    clazz.forEachName((n) => { this.methodNames.set(n, this.numOfMethods++) })
  }
}
