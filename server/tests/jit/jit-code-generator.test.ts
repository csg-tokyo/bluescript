import {beforeAll, expect, test} from "@jest/globals";
import {execSync} from "child_process";
import {Profiler} from "../../src/jit/profiler";
import {typeStringToStaticType} from "../../src/jit/utils";
import {
  compile, execute,
  initialCompile,
  tempCFilePath, tempExecutableFilePath,
} from "./test-jit-utils";


beforeAll(() => {
  execSync('mkdir -p ./temp-files')
})

test('simple code', () => {
  const src = 'print(1 + 1)'
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual('2\n')
})

test('profile: integer, float, boolean', () => {
  const src = `
function add(i, f, b) {
  return b ? i + f : i + f + f;
}

for(let i = 0; i < 15; i++) {
  add(1, 3.3, true)
}
print(add(1, 3.5, true))
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual("integer, float, boolean, undefined\n4.500000\n")
})

test('profile: string', () => {
  const src = `
function ss(s) {
  return 3;
}

for(let i = 0; i < 15; i++) {
  ss("hello");
}
print(ss("hello"))
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual("string, undefined, undefined, undefined\n3\n")
})

test('profile: intarray, floatarray, boolarray', () => {
  const src = `
function add0(iarr, farr, barr) {
  return barr[0] ? iarr[0] + farr[0] : iarr[0] + farr[0] + farr[0]
}

let iarr = [1, 2, 3];
let farr = [4.1, 5.1, 6.1];
let barr = [true, false];
for(let i = 0; i < 15; i++) {
  add0(iarr, farr, barr);
}
print(add0(iarr, farr, barr));
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual("Array<integer>, Array<float>, Array<boolean>, undefined\n5.100000\n")
})

test('profile: anyarray, array', () => {
  const src = `
function aarr0(aarr, arr) {
  return aarr[0];
}

let aarr:any[] = [1, "foo", 3];
let arr = ["hello"];
for(let i = 0; i < 15; i++) {
  aarr0(aarr, arr);
}
print(aarr0(aarr, arr));
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual("Array<any>, Array, undefined, undefined\n1\n")
})

test('profile: class', () => {
  const src = `
class Rectangle {
  x: integer
  y: integer
  
  constructor(x:integer, y:integer) {
    this.x = x;
    this.y = y;
  }
}
  
function area(rect) {
  return rect.x * rect.y;
}

let rect = new Rectangle(11, 4)
for(let i = 0; i < 15; i++) {
  area(rect);
}
print(area(rect));
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual("Rectangle, undefined, undefined, undefined\n44\n")
})

test('profile: not profile function with function return type', () => {
  const src = `
function func(a:()=>integer) {
  return a();
}

for(let i = 0; i < 15; i++) {
  func(()=>3)
}
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual('')
})

test('profile: not profile with type annotations', () => {
  const src = `
function add(a:integer, b:integer) {
  return a + b;
}

for(let i = 0; i < 15; i++) {
  add(1, 3)
}
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual('')
})

test('profile: not profile with too many params', () => {
  const src = `
function add(a, b, c, d, e) {
  return a + b + c + d + e;
}

for(let i = 0; i < 15; i++) {
  add(1, 2, 3, 4, 5)
}
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual('')
})

test('profile: function redefinition during profiling', () => {
  const src1 = `
function add(a, b) {
  return a + b;
}

for(let i = 0; i < 3; i++) {
  add(1, 3)
}
print(add(1, 3))
  `

  const src2 = `
function add(a, b) {
  return a + b + 2;
}

for(let i = 0; i < 15; i++) {
  add(1, 3)
}
print(add(1, 3))
  `

  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)
  const file2 = tempCFilePath('file2')
  const result2 = compile(1, src2, profiler, file2, result1.names)
  expect(execute([file0, file1, file2], [result1.main, result2.main], tempCFilePath('file4'), tempExecutableFilePath('bscript')))
    .toEqual(`4\ninteger, integer, undefined, undefined\n6\n`)
})


test('jit compile: integer, float, boolean', () => {
  const src1 = `
function add(i, f, b) {
  return b ? i + f : i + f + f;
}
print(add(1, 4.4, true))
  `

  const src3 = `
print(add(1, 5.5, false))
  `

  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)

  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    throw new Error(`Cannot fine func.`)
  profiler.setFuncSpecializedType(0, ["integer", "integer", "undefined", "undefined"].map(t => typeStringToStaticType(t, result1.names)))

  const file2 = tempCFilePath('file2')
  const result2 = compile(1, func.src, profiler, file2, result1.names)

  const file3 = tempCFilePath('file3')
  const result3 = compile(2, src3, profiler, file3, result2.names)
  expect(execute([file0, file1, file2, file3], [result1.main, result2.main, result3.main], tempCFilePath('file4'), tempExecutableFilePath('bscript')))
    .toEqual(`5.400000\n12.000000\n`)
})

test('jit compile: string', () => {
  const src1 = `
function printStr(str) {
  print(str);
}

printStr("hello");
  `

  const src3 = `
printStr("world");
  `

  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)

  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    throw new Error(`Cannot fined func.`)
  profiler.setFuncSpecializedType(0, ["string", "undefined", "undefined", "undefined"].map(t => typeStringToStaticType(t, result1.names)))

  const file2 = tempCFilePath('file2')
  const result2 = compile(1, func.src, profiler, file2, result1.names)

  const file3 = tempCFilePath('file3')
  const result3 = compile(2, src3, profiler, file3, result2.names)
  expect(execute([file0, file1, file2, file3], [result1.main, result2.main, result3.main], tempCFilePath('file4'), tempExecutableFilePath('bscript')))
    .toEqual(`hello\nworld\n`)
})

test('jit compile: intarray, floatarray, boolarray', () => {
  const src1 = `
function add0(iarr, farr, barr) {
  return barr[0] ? iarr[0] + farr[0] : iarr[0] + farr[0] + farr[0]
}

print(add0([1, 3], [1.1, 4.4], [true, false]));
  `

  const src3 = `
print(add0([1, 3], [1.1, 4.4], [false, false]));
  `

  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)

  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    throw new Error(`Cannot fined func.`)
  profiler.setFuncSpecializedType(0, ["Array<integer>", "Array<float>", "Array<boolean>", "undefined"].map(t => typeStringToStaticType(t, result1.names)))

  const file2 = tempCFilePath('file2')
  const result2 = compile(1, func.src, profiler, file2, result1.names)

  const file3 = tempCFilePath('file3')
  const result3 = compile(2, src3, profiler, file3, result2.names)
  expect(execute([file0, file1, file2, file3], [result1.main, result2.main, result3.main], tempCFilePath('file4'), tempExecutableFilePath('bscript')))
    .toEqual(`2.100000\n3.200000\n`)
})

test('jit compile: anyarray, array', () => {
  const src1 = `
function aarr0(aarr, arr) {
  return aarr[0];
}

let aarr:any[] = [1, "foo", 3];
let arr = ["hello"];

print(aarr0(aarr, arr));
  `

  const src3 = `
print(aarr0(aarr, arr));
  `

  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)

  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    throw new Error(`Cannot fined func.`)
  profiler.setFuncSpecializedType(0, ["Array<any>", "Array", "undefined", "undefined"].map(t => typeStringToStaticType(t, result1.names)))

  const file2 = tempCFilePath('file2')
  const result2 = compile(1, func.src, profiler, file2, result1.names)

  const file3 = tempCFilePath('file3')
  const result3 = compile(2, src3, profiler, file3, result2.names)
  expect(execute([file0, file1, file2, file3], [result1.main, result2.main, result3.main], tempCFilePath('file4'), tempExecutableFilePath('bscript')))
    .toEqual(`1\n1\n`)
})

test('jit compile: class', () => {
  const src1 = `
  
class Rectangle {
  x: integer
  y: integer
  
  constructor(x:integer, y:integer) {
    this.x = x;
    this.y = y;
  }
}
  
function area(rect) {
  return rect.x * rect.y;
}

print(area(new Rectangle(3, 4)))
  `

  const src3 = `
print(area(new Rectangle(3, 4)))
  `

  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)

  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    throw new Error(`Cannot fined func.`)
  profiler.setFuncSpecializedType(0, ["Rectangle", "undefined", "undefined", "undefined"].map(t => typeStringToStaticType(t, result1.names)))

  const file2 = tempCFilePath('file2')
  const result2 = compile(1, func.src, profiler, file2, result1.names)

  const file3 = tempCFilePath('file3')
  const result3 = compile(2, src3, profiler, file3, result2.names)
  expect(execute([file0, file1, file2, file3], [result1.main, result2.main, result3.main], tempCFilePath('file4'), tempExecutableFilePath('bscript')))
    .toEqual(`12\n12\n`)
})

test('jit compile: function redefinition after jit compile', () => {
  const src1 = `
function add(a, b) {
  return a + b
}
print(add(4, 5))
  `

  const src3 = `
print(add(4, 5))
  `

  const src4 = `
function add(a, b) {
  return a + b + 2
}
print(add(4, 5))
  `


  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)

  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    throw new Error(`Cannot fine func.`)
  profiler.setFuncSpecializedType(0, ["integer", "integer", "undefined", "undefined"].map(t => typeStringToStaticType(t, result1.names)))

  const file2 = tempCFilePath('file2')
  const result2 = compile(1, func.src, profiler, file2, result1.names)

  const file3 = tempCFilePath('file3')
  const result3 = compile(2, src3, profiler, file3, result2.names)

  const file4 = tempCFilePath('file4')
  const result4 = compile(3, src4, profiler, file4, result3.names)
  expect(execute([file0, file1, file2, file3, file4], [result1.main, result2.main, result3.main, result4.main], tempCFilePath('file5'), tempExecutableFilePath('bscript')))
    .toEqual(`9\n9\n11\n`)
})