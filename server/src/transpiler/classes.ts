// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import { FunctionType, ObjectType, StaticType, isPrimitiveType, isSubtype,
         typeToString, encodeType,
         ArrayType, StringType } from "./types"

// Type for instances of a class
export class InstanceType extends ObjectType {
  private properties: { [key: string]: [StaticType, number] } = {}
  private methods: { [key: string]: [StaticType, number, InstanceType] } = {}
  private constructorFunction: FunctionType | undefined = undefined
  private numOfProperties: number
  private numOfUnboxed: number | undefined = undefined
  private numOfMethods: number
  private superClass: ObjectType
  private subClasses: InstanceType[] = []
  private className: string
  private blueScriptName: string
  public leafType = false      // true if this class is a leaf class.

  constructor(name: string, bsName: string, superClass: ObjectType) {
    super()
    this.superClass = superClass
    this.className = name
    this.blueScriptName = bsName

    this.numOfProperties = superClass instanceof InstanceType ? superClass.objectSize() : 0
    this.numOfMethods = superClass instanceof InstanceType ? superClass.methodCount() : 0
  }

  // returns a globally-unique class name.  It may be different from the
  // original name given in the source code.
  override name() { return this.className }

  // the name given in the source code.
  override sourceName() { return this.blueScriptName }

  override superType(): ObjectType | null { return this.superClass }

  superclass(): ObjectType { return this.superClass }

  subclasses(): InstanceType[] { return this.subClasses }

  // false if this class extends another class that is not Object class.
  extendsObject() { return !(this.superClass instanceof InstanceType) }

  objectSize() { return this.numOfProperties }

  methodCount() { return this.numOfMethods }

  // returns an effective value after calling sortProperties()
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

  forEachMethod(f: (n: string, t: StaticType, index: number, declaring: InstanceType) => void) {
    for (const name in this.methods) {
      const m = this.methods[name]
      const type = m[0]
      const index = m[1]
      const declaring = m[2]
      f(name, type, index, declaring)
    }
  }

  forEachMethodName(f: (n: string) => void) {
    for (const name in this.methods)
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
            return `an overriding method with an incompatible type: ${name}. '${typeToString(type)}' is not a subtype of '${typeToString(found[0])}'.`
        else
          index = this.numOfMethods++
      }
      else
        index = this.numOfMethods++

      this.methods[name] = [type, index, this]
    }

    return undefined  // no error
  }

  findMethod(name: string): [StaticType, number, InstanceType] | undefined {
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

const builtinPropertiesAndMethods: string[]
  = [ ArrayType.lengthProperty,     // 0
      StringType.startsWithMethod,  // 1
      StringType.endsWithMethod,    // 2
      StringType.substringMethod,   // 3
      ArrayType.pushMethod,         // 4
      ArrayType.popMethod,          // 5
      ArrayType.unshiftMethod,      // 6
      ArrayType.shiftMethod,        // 7
    ]

export class ClassTable {
  private names
  private numOfNames
  private rootClasses: InstanceType[]

  constructor() {
    this.names = new Map<string, number>()
    builtinPropertiesAndMethods.forEach((name, index) => this.names.set(name, index))
    this.numOfNames = builtinPropertiesAndMethods.length
    this.rootClasses = []
  }

  // return all the property and method names.
  propertyNames() { return this.names.entries() }

  // adds a property or method name used in precompiled source code.
  addPropertyName(name: string, id: number) {
    let maxId = this.numOfNames
    if (id >= maxId)
      maxId = id + 1

    const i = this.names.get(name)
    if (i === undefined)
      this.names.set(name, id)
    else
      if (i !== id)
        throw new Error(`fatal: duplicate property/method name: ${name}, ${id}`)

    this.numOfNames = maxId
  }

  // returns all the classes that do not inherit from another class.
  roots() { return this.rootClasses }

  // clazz must be added after all properties and methods are
  //   added to it.
  addClass(name: string, clazz: InstanceType) {
    const f = (name: string) => {
      if (this.names.get(name) === undefined)
        this.names.set(name, this.numOfNames++)
    }

    clazz.forEachName(f)
    clazz.forEachMethodName(f)
    const sup = clazz.superclass()
    if (sup instanceof InstanceType)
      sup.subclasses().push(clazz)
    else
      this.rootClasses.push(clazz)
  }

  // name is a property or method name.
  encodeName(name: string) {
    return this.names.get(name)
  }

  propertyTable(clazz: InstanceType) {
    const superClass = clazz.superType()
    const offset = superClass instanceof InstanceType ? superClass.objectSize() : 0
    const unboxed = clazz.unboxedProperties() || 0
    let props: number[] = []
    let unboxedTypes: string[] = []

    clazz.forEach((name: string, type: StaticType, index: number) => {
      const code = this.encodeName(name)
      props[index - offset] = code === undefined ? -1 : code
      if (index < unboxed)
        unboxedTypes[index - offset] = encodeType(type)
    })

    return { offset: offset, unboxed: unboxed,
             props: props, unboxedTypes: unboxedTypes.join('')}
  }
}
