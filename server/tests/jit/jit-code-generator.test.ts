import {beforeAll, expect, test} from "@jest/globals";
import {execSync} from "child_process";
import {callCountThreshold, Profiler} from "../../src/jit/profiler";
import {
  compile, execute,
  initialCompile,
  tempCFilePath, tempExecutableFilePath,
  writeProfilerStub
} from "./test-jit-utils";
import {Integer} from "../../src/transpiler/types";


beforeAll(() => {
  execSync('mkdir -p ./temp-files')
  writeProfilerStub()
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

for(let i = 0; i < ${callCountThreshold}; i++) {
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
    .toEqual("fid: 0, p1: 4, p2: 12, p3: 0, p4: 0\n4\n")
})

test('profiler call: not call', () => {
  const src = `
function add(a:integer, b:integer) {
  return a + b;
}

for(let i = 0; i < ${callCountThreshold}; i++) {
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
    .toEqual('4\n')
})

test('profiler call: not call 2', () => {
  const src = `
function add(a, b, c, d, e) {
  return a + b + c + d + e;
}

for(let i = 0; i < ${callCountThreshold}; i++) {
  add(1, 2, 3, 4, 5)
}
print(add(1, 2, 3, 4, 5))
  `
  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src, profiler, file1, result0.names)
  expect(execute([file0, file1], [result1.main], tempCFilePath('file2'), tempExecutableFilePath('bscript')))
    .toEqual('15\n')
})

test('function redefinition during profiling', () => {
  const src1 = `
function add(a, b) {
  return a + b;
}

for(let i = 0; i < ${callCountThreshold}; i++) {
  add(1, 3)
}
print(add(1, 3))
  `

  const src2 = `
function add(a, b) {
  return a + b + 2;
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
    .toEqual(`\
fid: 0, p1: 4, p2: 12, p3: 0, p4: 0
4
fid: 0, p1: 4, p2: 12, p3: 0, p4: 0
6
`)
})


test('jit compile', () => {
  const src1 = `
function add(a, b) {
  let result = 0;
  for (let i = 0; i < 100000000; i++) {
    result += a + b;
  }
  return result;
}
const t0 = performance_now();
const result = add(1, 3)
const t1 = performance_now();
print(result)
print(t1 - t0)
print("foo")
  `

  const src3 = `
const t3 = performance_now();
const result2 = add(1, 3)
const t4 = performance_now();
print(result2)
print(t1 - t0)
print("hello")
  `



  const profiler = new Profiler()
  const file0 = tempCFilePath('file0')
  const result0 = initialCompile(file0);
  const file1 = tempCFilePath('file1')
  const result1 = compile(0, src1, profiler, file1, result0.names)

  const func = profiler.getFunctionProfileById(0);
  if (func === undefined)
    throw new Error(`Cannot fine func.`)
  profiler.setFuncSpecializedType(0, [Integer, Integer])

  const file2 = tempCFilePath('file2')
  const result2 = compile(1, func.src, profiler, file2, result1.names)

  const file3 = tempCFilePath('file3')
  const result3 = compile(2, src3, profiler, file3, result2.names)
  expect(execute([file0, file1, file2, file3], [result1.main, result2.main, result3.main], tempCFilePath('file4'), tempExecutableFilePath('bscript')))
    .toEqual(``)
})