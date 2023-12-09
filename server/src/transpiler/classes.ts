// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { FunctionType, ObjectType, StaticType } from "./types"

// Type for instances of a class
export class InstanceType extends ObjectType {
  private properties: { [key: string]: [StaticType, number] } = {}
  private constructorFunction: FunctionType | undefined = undefined
  private numOfProperties: number
  private superClass: ObjectType
  private className: string

  constructor(name: string, superClass: ObjectType) {
    super()
    this.superClass = superClass
    this.className = name
    this.numOfProperties = superClass instanceof InstanceType ? superClass.objectSize() : 0
  }

  name() { return this.className }

  superType(): ObjectType | null { return this.superClass }

  objectSize() { return this.numOfProperties }

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
    if (name === 'constructor') {
      const success = !this.constructorFunction
      if (type instanceof FunctionType)
        this.constructorFunction = type
      else
        return false

      return success
    }
    else {
      const success = !this.properties[name]
      this.properties[name] = [type, this.numOfProperties++]
      return success
    }
  }

  findProperty(name: string): [StaticType, number] | undefined {
    const found = this.properties[name]
    if (found)
      return found

    const superClass = this.superClass
    if (superClass instanceof InstanceType)
      return superClass.findProperty(name)
    else
      return undefined
  }

  findConstructor() { return this.constructorFunction }
}

export class ClassTable {
  private methodNames = new Map<string, number>()
  private numOfMethods = 0

  // clazz must be added after all properties and methods are
  //   added to it.
  addClass(name: string, clazz: InstanceType) {
    clazz.forEachName((name) => {
      if (this.methodNames.get(name) === undefined)
        this.methodNames.set(name, this.numOfMethods++)
    })
  }
}
