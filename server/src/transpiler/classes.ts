// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { FunctionType, ObjectType, StaticType, isPrimitiveType, isSubtype, objectType } from "./types"

// Type for instances of a class
export class InstanceType extends ObjectType {
  private properties: { [key: string]: [StaticType, number] } = {}
  private methods: { [key: string]: [StaticType, number] } = {}
  private constructorFunction: FunctionType | undefined = undefined
  private numOfProperties: number
  private numOfUnboxed: number | undefined = undefined
  private numOfMethods: number
  private superClass: ObjectType
  private className: string

  constructor(name: string, superClass: ObjectType) {
    super()
    this.superClass = superClass
    this.className = name

    this.numOfProperties = superClass instanceof InstanceType ? superClass.objectSize() : 0
    this.numOfMethods = superClass instanceof InstanceType ? superClass.methodCount() : 0
  }

  name() { return this.className }

  superType(): ObjectType | null { return this.superClass }

  superclass(): ObjectType { return this.superClass }

  // false if this class extends another class that is not Object class.
  extendsObject() { return !(this.superClass instanceof InstanceType) }

  objectSize() { return this.numOfProperties }

  methodCount() { return this.numOfMethods }

  unboxedProperties() { return this.numOfUnboxed }

  declaredProperties() {
    const size = this.superClass instanceof InstanceType ? this.superClass.objectSize() : 0
    return this.objectSize() - size
  }

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

  addMethod(name: string, type: StaticType): string | undefined {
    if (name === 'constructor') {
      const success = !this.constructorFunction
      if (type instanceof FunctionType)
        this.constructorFunction = type
      else
        return 'multiple constructors are not allowed'
    }
    else {
      if (this.findProperty(name))
        return `duplicate property name: ${name}`

      // if (this.methods[name] !== undefined)
      if (this.methods[name])
        return `duplicate method name: ${name}`

      let index: number
      const superClass = this.superClass
      if (superClass instanceof InstanceType) {
        const found = superClass.findMethod(name)
        if (found)
          if (isSubtype(type, found[0]))
            index = found[1]
          else
            return `an overriding method with an incompatible type: ${name}`
        else
          index = this.numOfMethods++
      }
      else
        index = this.numOfMethods++

      this.methods[name] = [type, index]
    }

    return undefined  // no error
  }

  findMethod(name: string): [StaticType, number] | undefined {
    const found = this.methods[name]
    if (found)
      return found

    const superClass = this.superClass
    if (superClass instanceof InstanceType)
      return superClass.findMethod(name)
    else
      return undefined
  }

  private methodTable: {name: string, type: StaticType, clazz: InstanceType}[] | undefined = undefined

  makeMethodTable() {
    if (this.methodTable !== undefined)
      return this.methodTable

    let table: Array<{ name: string, type: StaticType, clazz: InstanceType}>
    if (this.superClass instanceof InstanceType)
      table = this.superClass.makeMethodTable()
    else
      table = []

    for (const name in this.methods) {
      const mth = this.methods[name]
      table[mth[1]] = { name: name, type: mth[0], clazz: this }
    }

    this.methodTable = table
    return table
  }

  addProperty(name: string, type: StaticType) {
    if (name === 'constructor') {
      // a constructor must be added by addMethod()
      return false
    }
    else {
      if (this.findMethod(name) !== undefined)
        return false

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

  // move a property of primitive type to the front (an element with a smaller index).
  sortProperties() {
    let index = 0
    if (this.superClass instanceof InstanceType) {
      const size = this.superClass.objectSize()
      const k = this.superClass.unboxedProperties()
      if (k === undefined || k !== size) {
        this.numOfUnboxed = k
        return
      }

      index = size
    }

    for (const name in this.properties) {
      const value = this.properties[name]
      if (isPrimitiveType(value[0]))
        value[1] = index++
    }

    this.numOfUnboxed = index
    for (const name in this.properties) {
      const value = this.properties[name]
      if (!isPrimitiveType(value[0]))
        value[1] = index++
    }
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
