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

test('profiler call: call', () => {
  const src = `
function add(a, b) {
  return a + b;
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
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual("integer, integer, undefined, undefined\n4\n")
})

test('profiler call: array', () => {
  const src = `
function add0(a, b) {
  return a[0] + b[0];
}

let arr = [1, 2, 3];
let arr2 = [4.1, 5.1, 6.1];
for(let i = 0; i < 15; i++) {
  add0(arr, arr2);
}
print(add0(arr, arr2));
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual("Array<integer>, Array<float>, undefined, undefined\n5.100000\n")
})


test('profiler call: class', () => {
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

test('profiler call: not call', () => {
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

test('profiler call: not call 2', () => {
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

test('function redefinition during profiling', () => {
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


test('jit compile', () => {
  const src1 = `
function add(a, b) {
  return a + b;
}
print(add(1,4))
  `

  const src3 = `
print(add(5, 6))
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
    .toEqual(`5\n11\n`)
})

test('jit compile with class', () => {
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

test('jit compile with string', () => {
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