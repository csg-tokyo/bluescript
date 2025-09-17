import {GlobalVariableNameTable} from "../transpiler/code-generator/variables";
import * as fs from "fs";
import * as path from "path";
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


const C_PROLOG = (cRuntimePath: string, profilerPath: string) => `
#include <stdint.h>
#include "${cRuntimePath}"
#include "${profilerPath}"
`


export default class Session {
  compileId: number = 0;
  baseGlobalNames: GlobalVariableNameTable;
  moduleIds: {[name: string]: string};
  modules: Map<string, GlobalVariableNameTable>;
  shadowMemory: ShadowMemory;
  profiler: Profiler;
  addresses: MemoryAddresses;

  private readonly BUILE_DIR: string;
  private readonly MODULES_DIR: string;
  private readonly RUNTIME_DIR: string;
  private readonly COMPILER_DIR: string;

  private readonly C_PROLOG: string;

  constructor(addresses: MemoryAddresses, 
    buildDir: string, 
    modulesDir: string, 
    runtimeDir: string,
    compilerDir: string
  ) {
    this.BUILE_DIR = buildDir;
    this.MODULES_DIR = modulesDir;
    this.RUNTIME_DIR = runtimeDir;
    this.COMPILER_DIR = compilerDir;
    this.C_PROLOG = C_PROLOG(FILE_PATH.C_RUNTIME_H(runtimeDir), FILE_PATH.PROFILER_H(runtimeDir));

    this.addresses = addresses;
    const bsString = fs.readFileSync(FILE_PATH.STD_MODULE(modulesDir)).toString()
    const result = transpile(++this.compileId, bsString, undefined);
    this.baseGlobalNames = result.names;
    this.modules = new Map<string, GlobalVariableNameTable>()
    this.shadowMemory = new ShadowMemory(runtimeDir, addresses)
    this.profiler = new Profiler();
    this.moduleIds = JSON.parse(fs.readFileSync(FILE_PATH.MODULE_NAME_TO_ID(modulesDir)).toString());
  }

  public reset() {
    const bsString = fs.readFileSync(`${FILE_PATH.STD_MODULE(this.MODULES_DIR)}`).toString()
    const result = transpile(++this.compileId, bsString, undefined);
    this.baseGlobalNames = result.names;
    this.modules = new Map<string, GlobalVariableNameTable>();
    this.shadowMemory = new ShadowMemory(this.RUNTIME_DIR, this.addresses);
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
    const cString = this.C_PROLOG + tResult.code;
    const compiler = new Compiler(this.BUILE_DIR, this.COMPILER_DIR);
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
    const cString = this.C_PROLOG + tResult.code;
    const compiler = new InteractiveCompiler(this.BUILE_DIR, this.COMPILER_DIR);
    compiler.compile(this.shadowMemory, this.compileId, cString, entryPointName);
    const end = performance.now();
    return  {result: this.shadowMemory.getUpdates(), compileTime:end-start, compileId: this.compileId}
  }

  public interactiveCompileWithProfiling(src: string) {
    const start = performance.now();
    this.compileId += 1;

    // Transpile
    const tResult = this.transpileForJIT(src)
    const entryPointName = tResult.main;
    this.baseGlobalNames = tResult.names;
    const cString = this.C_PROLOG + tResult.code;

    // Compile
    const compiler = new InteractiveCompiler(this.BUILE_DIR, this.COMPILER_DIR);
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
    const cString = this.C_PROLOG + tResult.code;

    // Compile
    const compiler = new InteractiveCompiler(this.BUILE_DIR, this.COMPILER_DIR);
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
        const ffi = fs.readFileSync(path.join(this.MODULES_DIR, fname, `${fname}.bs`)).toString();
        const moduleId = this.readModuleId(fname);
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names);
        const compiler = new ModuleCompiler(this.BUILE_DIR, this.COMPILER_DIR);
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
        const ffi = fs.readFileSync(path.join(this.MODULES_DIR, fname, `${fname}.bs`)).toString();
        const moduleId = this.readModuleId(fname);
        const result = transpile(0, ffi, this.baseGlobalNames, importer, moduleId);
        this.modules.set(fname, result.names);
        const compiler = new ModuleCompiler(this.BUILE_DIR, this.COMPILER_DIR);
        compiler.compile(this.shadowMemory, -1, fname, result.main);
        return result.names;
      }
    }

    const codeGenerator = (initializerName: string, codeId: number, moduleId: string) => {
      return new JitCodeGenerator(initializerName, codeId, moduleId, this.profiler, src);
    }

    const typeChecker = (maker: NameTableMaker<NameInfo>) => {
      return new JitTypeChecker(maker, importer);
    }

    const ast = runBabelParser(src, 1);
    convertAst(ast, this.profiler);
    return  jitTranspile(this.compileId, ast, typeChecker, codeGenerator, this.baseGlobalNames)
  }

  private readModuleId(name: string):string {
    const moduleId = this.moduleIds[name];
    if (moduleId === undefined) {
      throw Error(`Cannot find module id corresponding to module name: ${name}`);
    }
    return moduleId;
  }
}