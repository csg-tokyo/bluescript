import {CodeGenerator} from "../transpiler/code-generator/code-generator";
import {Profiler} from "./profiler";

export default class JitCodeGenerator2 extends CodeGenerator{
  private profiler: Profiler;
  private bsSrc: string[];


  constructor(initializerName: string, codeId: number, moduleId: number, profiler: Profiler, src: string) {
    super(initializerName, codeId, moduleId);
    this.profiler = profiler;
    this.bsSrc = src.split('\n');
  }



}