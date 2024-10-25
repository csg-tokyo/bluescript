import {CodeGenerator} from "../transpiler/code-generator/code-generator";
import * as AST from "@babel/types";
import {FunctionEnv} from "../transpiler/code-generator/variables";
import {Any, encodeType, FunctionType} from "../transpiler/types";
import * as cr from "../transpiler/code-generator/c-runtime";
import {FunctionDeclaration, isArrowFunctionExpression, isClassMethod} from "@babel/types";
import {callCountBorder, callCountName, originalFuncPrefix, Profiler, typeCounterName} from "./profiler";
import {specializedFuncPrefix} from "./ast-converter";

export class JITProfilingCodeGenerator extends CodeGenerator {
  private profiler: Profiler;
  private tsSrc: string[];


  constructor(initializerName: string, codeId: number, moduleId: number, profiler: Profiler, src: string) {
    super(initializerName, codeId, moduleId);
    this.profiler = profiler;
    this.tsSrc = src.split('\n');
  }

  protected functionBody(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression | AST.ClassMethod,
                         fenv: FunctionEnv, funcType: FunctionType, bodyName: string,
                         modifier: string = 'static ') {
    if (isArrowFunctionExpression(node) || isClassMethod(node))
      return super.functionBody(node, fenv, funcType, bodyName, modifier);
    if (!funcType.paramTypes.includes(Any))
      return super.functionBody(node, fenv, funcType, bodyName, modifier);

    const funcName = (node.id as AST.Identifier).name
    const funcInfo = fenv.table.lookup(funcName)
    const transpiledFuncName = funcInfo ? funcInfo.transpiledName(funcName) : funcName

    const src = this.tsSrc.slice((node.loc?.start.line ?? 0) - 1, node.loc?.end.line).join('\n');
    const funcProfilerId = this.profiler.setFunc(funcName, src, funcType);

    const funcHeader = super.functionBody(node, fenv, funcType, originalFuncPrefix + '_' +bodyName, modifier);

    this.signatures += this.makeFunctionStruct(originalFuncPrefix+transpiledFuncName, funcType, false)
    this.declarations.write(`${cr.funcStructInC} ${originalFuncPrefix+transpiledFuncName} = { ${originalFuncPrefix}_${bodyName}, "${encodeType(funcType)}" };`).nl()
    this.result.nl();

    const bodyResult = this.result.copy()
    const sig = this.makeParameterList(funcType, node, fenv, bodyResult)
    this.result.write(`${modifier}${cr.typeToCType(funcType.returnType, bodyName)}${sig}`).write(' {')
    this.result.right().nl();

    this.functionProfiling(node, fenv, funcType, funcProfilerId);

    // call original function
    this.result.write('return ');
    const ftype = cr.funcTypeToCType(funcType)
    this.result.write(`((${ftype})${originalFuncPrefix + transpiledFuncName}.${cr.functionPtr})(`)
    let paramSig = 'self'
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      paramSig += ', '
      const paramName = (node.params[i] as AST.Identifier).name
      const info = fenv.table.lookup(paramName)
      if (info !== undefined) {
        const name = info.transpiledName(paramName)
        paramSig += name
      }
    }
    this.result.write(paramSig).write(');');
    this.result.left().nl();
    this.result.write('}').nl();

    return funcHeader
  }

  private functionProfiling(node: FunctionDeclaration, fenv: FunctionEnv, funcType: FunctionType, funcProfilerId:number) {
    this.result.write(`static uint8_t ${callCountName} = 0;`).nl();
    this.result.write(`${callCountName} < ${callCountBorder} ? ${callCountName}++ : ${typeCounterName}(`)
    let profSig = `${funcProfilerId}`;
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      profSig += ', '
      const paramName = (node.params[i] as AST.Identifier).name
      const info = fenv.table.lookup(paramName)
      if (info !== undefined && funcType.paramTypes[i] === Any) {
        const name = info.transpiledName(paramName)
        profSig += name
      }
    }
    this.result.write(profSig).write(');').nl();
  }
}

export class JITSpecializingCodeGenerator extends CodeGenerator {
  private profiler: Profiler;

  constructor(initializerName: string, codeId: number, moduleId: number, profiler: Profiler) {
    super(initializerName, codeId, moduleId);
    this.profiler = profiler;
  }

  protected functionBody(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression | AST.ClassMethod,
                         fenv: FunctionEnv, funcType: FunctionType, bodyName: string,
                         modifier: string = 'static ') {
    if (isArrowFunctionExpression(node) || isClassMethod(node))
      return super.functionBody(node, fenv, funcType, bodyName, modifier);

    const funcName = (node.id as AST.Identifier).name;
    if ((new RegExp(`^${specializedFuncPrefix}`)).test(funcName)) {
      console.log(funcName)
    }

    return super.functionBody(node, fenv, funcType, bodyName, modifier);
  }
}
