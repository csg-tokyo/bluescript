import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import {FILE_PATH} from "../constants";
import {transpile} from "../transpiler/code-generator/code-generator";
import {Profiler} from "../jit-transpiler/profiler";
import {runBabelParser} from "../transpiler/utils";
import {convertAst, typeStringToStaticType} from "../jit-transpiler/utils";
import {JitCodeGenerator, jitTranspile} from "../jit-transpiler/jit-code-generator";
import {NameInfo, NameTableMaker} from "../transpiler/names";
import {JitTypeChecker} from "../jit-transpiler/jit-type-checker";
import {Compiler, InteractiveCompiler, ModuleCompiler} from "../compiler/compiler";
import {ShadowMemory, MemoryAddresses} from "../compiler/shadow-memory";


const cProlog = `
#include <stdint.h>
#include "../${FILE_PATH.C_RUNTIME_H}"
#include "../${FILE_PATH.PROFILER_H}"
`


export default class Session {
  compileId: number = 0;
  baseGlobalNames: GlobalVariableNameTable
  modules: Map<string, GlobalVariableNameTable>
  shadowMemory: ShadowMemory;
  profiler: Profiler;
  addresses: MemoryAddresses

  constructor(addresses: MemoryAddresses) {
    this.addresses = addresses;
    const bsString = fs.readFileSync(`${FILE_PATH.STD_MODULES}`).toString()
    const result = transpile(++this.compileId, bsString, undefined);
    this.baseGlobalNames = result.names;
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, addresses)
    this.profiler = new Profiler();
  }

  public reset() {
    const bsString = fs.readFileSync(`${FILE_PATH.STD_MODULES}`).toString()
    const result = transpile(++this.compileId, bsString, undefined);
    this.baseGlobalNames = result.names;
    this.modules = new Map<string, GlobalVariableNameTable>();
    this.shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, this.addresses);
    this.profiler = new Profiler();
  }

  public compile(src: string) {
    const start = performance.now();
    this.reset();

    this.compileId += 1;

    // Transpile
    const tResult = this.transpile(src);
    const entryPointName = tResult.main;
    this.baseGlobalNames = tResult.names;

    // Compile
    const cString = cProlog + tResult.code;
    const compiler = new Compiler();
    compiler.compile(this.shadowMemory, this.compileId, cString, entryPointName);
    const end = performance.now();
    return  {result: this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  public interactiveCompile(src: string) {
    const start = performance.now();
    this.compileId += 1;

    // Transpile
    const tResult = this.transpile(src);
    const entryPointName = tResult.main;
    this.baseGlobalNames = tResult.names;

    // Compile
    const cString = cProlog + tResult.code;
    const compiler = new InteractiveCompiler();
    compiler.compile(this.shadowMemory, this.compileId, cString, entryPointName);
    const end = performance.now();
    return  {result: this.shadowMemory.getUpdates(), compileTime:end-start}
  }

  public InteractiveCompileWithProfiling(src: string) {
    const start = performance.now();
    this.compileId += 1;

    // Transpile
    const tResult = this.transpileForJIT(src)
    const entryPointName = tResult.main;
    this.baseGlobalNames = tResult.names;
    const cString = cProlog + tResult.code;

    // Compile
    const compiler = new InteractiveCompiler();
    compiler.compile(this.shadowMemory, this.compileId, cString, entryPointName);
    const end = performance.now();
    return {result: this.shadowMemory.getUpdates(), compileTime:end-start, compileId: this.compileId}
  }

  public jitCompile(funcId: number, paramTypes: string[]) {
    const start = performance.now();
    this.compileId += 1

    const func = this.profiler.getFunctionProfileById(funcId);
    if (func === undefined)
      return {}; // TODO： 要修正
    this.profiler.setFuncSpecializedType(funcId, paramTypes.map(t => typeStringToStaticType(t, this.baseGlobalNames)))

    // Transpile
    const tResult = this.transpileForJIT(func.src)
    const entryPointName = tResult.main;
    this.baseGlobalNames = tResult.names;
    const cString = cProlog + tResult.code;

    // Compile
    const compiler = new InteractiveCompiler();
    compiler.compile(this.shadowMemory, this.compileId, cString, entryPointName);
    const end = performance.now();
    return {result: this.shadowMemory.getUpdates(), compileTime:end-start, compileId: this.compileId}
  }

  public codeExecutionFinished(compileId: number) {
    this.shadowMemory.freeIram(compileId);
  }

  private transpile(src: string) {
    const importer = (fname: string) => {
      const mod = this.modules.get(fname);
      if (mod)
        return mod;
      else {
        const ffi = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}/${fname}.bs`).toString();
        const moduleId = Session.moduleNameToId(fname);
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names);
        const compiler = new ModuleCompiler();
        compiler.compile(this.shadowMemory, -1, fname, result.main);
        return result.names;
      }
    }

    return transpile(this.compileId, src, this.baseGlobalNames, importer);
  }

  private transpileForJIT(src: string) {
    const importer = (fname: string) => {
      const mod = this.modules.get(fname);
      if (mod)
        return mod;
      else {
        const ffi = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}/${fname}.bs`).toString();
        const moduleId = Session.moduleNameToId(fname);
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names);
        const compiler = new ModuleCompiler();
        compiler.compile(this.shadowMemory, -1, fname, result.main);
        return result.names
      }
    }

    const codeGenerator = (initializerName: string, codeId: number, moduleId: number) => {
      return new JitCodeGenerator(initializerName, codeId, moduleId, this.profiler, src);
    }

    const typeChecker = (maker: NameTableMaker<NameInfo>) => {
      return new JitTypeChecker(maker, importer);
    }

    const ast = runBabelParser(src, 1);
    convertAst(ast, this.profiler);
    return  jitTranspile(this.compileId, ast, typeChecker, codeGenerator, this.baseGlobalNames)
  }

  public dummyExecute() {
    const start = performance.now();
    // Compile
    const cSrc = fs.readFileSync('./temp-files/dummy-code.c').toString()
    const compiler = new InteractiveCompiler();
    compiler.compile(this.shadowMemory, -1, cSrc, 'bluescript_main6_')
    const end = performance.now();
    return {result: this.shadowMemory.getUpdates(), compileTime:end-start, compileId: -1}
  }

  static moduleNameToId(fname: string):number {
    let result = "";
    for (let i = 0; i < fname.length; i++) {
      result += fname.charCodeAt(i);
    }
    return parseInt(result, 10) ?? 0;
  }
}