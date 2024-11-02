import {CodeGenerator} from "../transpiler/code-generator/code-generator";
import * as AST from "@babel/types";
import {FunctionEnv, getVariableNameTable, VariableEnv, VariableInfo} from "../transpiler/code-generator/variables";
import {Any, ArrayType, BooleanT, encodeType, Float, FunctionType, Integer, StaticType} from "../transpiler/types";
import * as cr from "../transpiler/code-generator/c-runtime";
import {FunctionDeclaration} from "@babel/types";
import {
  callCountThreshold,
  callCounterName,
  FunctionProfile,
  Profiler,
  typeCounterName,
  typeCountFunctionName, maxParamNum
} from "./profiler";
import {specializedFuncPrefix} from "./ast-converter";
import {getStaticType} from "../transpiler/names";
import {typeConversion} from "../transpiler/code-generator/c-runtime";

function originalFunctionName(name: string) {
  return `original${name}`;
}

function originalFunctionBodyName(name: string) {
  return `original_${cr.functionBodyName(name)}`;
}

function specializedFunctionName(name: string) {
  return `specialized${name}`;
}

function specializedFunctionBodyName(name: string) {
  return `specialized_${cr.functionBodyName(name)}`;
}

// returns '(' or '<type check function>('
// '(' is returned if the type cannot be checked.
function checkType(type?: StaticType) {
  if (type instanceof ArrayType) {
    if (type.elementType === Integer)
      return 'gc_is_intarray(';
    if (type.elementType === Float)
      return 'gc_is_floatarray(';
    if (type.elementType === BooleanT) // TODO: 要チェック
      return 'gc_is_bytearray(';
    else
      return undefined
  }

  switch (type) {
    case Integer:
      return 'is_int_value(';
    case Float:
      return 'is_float_value(';
    case BooleanT:
      return 'is_int_value(';
    default:
      return undefined;
  }
}

export class JITProfilingCodeGenerator extends CodeGenerator {
  private profiler: Profiler;
  private tsSrc: string[];


  constructor(initializerName: string, codeId: number, moduleId: number, profiler: Profiler, src: string) {
    super(initializerName, codeId, moduleId);
    this.profiler = profiler;
    this.tsSrc = src.split('\n');
  }

  // 引数が違うだけ
  functionBodyDeclaration2(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression,
                          funcName: string, bodyName: string, env: VariableEnv,
                           funcInfo?: VariableInfo, isStatic: boolean = true): FunctionEnv {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    fenv.allocateRootSet()
    const funcType = getStaticType(node) as FunctionType;

    const prevResult = this.result
    this.result = this.declarations
    if (isStatic)
      this.functionBody(node, fenv, funcType, bodyName)
    else
      this.functionBody(node, fenv, funcType, bodyName, '')   // not a static function

    this.result = prevResult

    if (fenv.isFreeVariable(funcInfo))
      this.result.nl().write(`${funcName}.${cr.functionPtr} = ${bodyName};`).nl()
    else {
      this.signatures += this.makeFunctionStruct(funcName, funcType, false)
      this.declarations.write(`${cr.funcStructInC} ${funcName} = { ${bodyName}, "${encodeType(funcType)}" };`).nl()
    }

    return fenv
  }

  // TODO: original funcを再定義する場合にも対応
  functionDeclaration(node: FunctionDeclaration, env: VariableEnv) {
    const fname = (node.id as AST.Identifier).name
    const funcInfo = env.table.lookup(fname)
    const funcType = getStaticType(node) as FunctionType;
    const transpiledFuncName = funcInfo ? funcInfo.transpiledName(fname) : fname

    if (!funcType.paramTypes.includes(Any) || funcType.paramTypes.filter(t=> t === Any).length > maxParamNum)
      return super.functionDeclaration(node, env);

    const src = this.tsSrc.slice((node.loc?.start.line ?? 0) - 1, node.loc?.end.line).join('\n');
    const profilerId = this.profiler.setFunctionProfile(fname, src, funcType);

    const originalFuncName = originalFunctionName(transpiledFuncName)
    const originalBodyName = originalFunctionBodyName(transpiledFuncName)
    this.functionBodyDeclaration2(node, originalFuncName, originalBodyName, env, funcInfo)

    const wrapperFuncName = transpiledFuncName
    const wrapperBodyName = cr.functionBodyName(transpiledFuncName)
    this.wrapperFunctionDeclaration(node, wrapperFuncName, wrapperBodyName, originalFuncName, profilerId, env)
  }

  private wrapperFunctionDeclaration(node: AST.FunctionDeclaration,
                                     wrapperFuncName: string, wrapperBodyName: string, originalFuncName: string,
                                     profilerId: number, env: VariableEnv, isStatic: boolean = true): FunctionEnv {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    const funcType = getStaticType(node) as FunctionType;
    const prevResult = this.result
    this.result = this.declarations
    if (isStatic)
      this.wrapperFunctionBody(node, originalFuncName, fenv, funcType, wrapperBodyName, profilerId)
    else
      this.wrapperFunctionBody(node, originalFuncName, fenv, funcType, wrapperBodyName, profilerId, '')
    this.result = prevResult

    this.signatures += this.makeFunctionStruct(wrapperFuncName, funcType, false)
    this.declarations.write(`${cr.funcStructInC} ${wrapperFuncName} = { ${wrapperBodyName}, "${encodeType(funcType)}" };`).nl()
    return fenv
  }


  private wrapperFunctionBody(node: AST.FunctionDeclaration, originalFuncName: string,
                              fenv: FunctionEnv, funcType: FunctionType, bodyName: string, profilerId: number,
                         modifier: string = 'static ') {
    const bodyResult = this.result.copy()
    const sig = this.makeParameterList(funcType, node, fenv, bodyResult)
    this.result.write(`${modifier}${cr.typeToCType(funcType.returnType, bodyName)}${sig}`).write(' {')
    this.result.right().nl();

    this.functionProfiling(node, fenv, funcType, profilerId);

    this.result.write('return ');
    const ftype = cr.funcTypeToCType(funcType)
    this.result.write(`((${ftype})${originalFuncName}.${cr.functionPtr})(`)
    let paramSig = ['self']
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      const paramName = (node.params[i] as AST.Identifier).name
      const info = fenv.table.lookup(paramName)
      if (info !== undefined) {
        const name = info.transpiledName(paramName)
        paramSig.push(name);
      }
    }
    this.result.write(paramSig.join(', ')).write(');');
    this.result.left().nl();
    this.result.write('}').nl();
  }

  private functionProfiling(node: FunctionDeclaration, fenv: FunctionEnv, funcType: FunctionType, funcProfilerId:number) {
    this.result.write(`static uint8_t ${callCounterName} = 0;`).nl();
    this.result.write(`static uint8_t ${typeCounterName} = 0;`).nl();
    this.result.write(`${callCounterName} < ${callCountThreshold} ? ${callCounterName}++ : ${typeCountFunctionName}(`)
    let profSig = `${funcProfilerId}, ${typeCounterName}++`;
    let c = 0;
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      const paramName = (node.params[i] as AST.Identifier).name
      const info = fenv.table.lookup(paramName)
      if (info !== undefined && funcType.paramTypes[i]==Any) {
        c += 1;
        profSig += ', '
        const name = info.transpiledName(paramName)
        profSig += name
      }
    }
    profSig += ', 0'.repeat(maxParamNum - c);
    this.result.write(profSig).write(');').nl();
  }
}

export class JITSpecializingCodeGenerator extends CodeGenerator {
  private profiler: Profiler;

  constructor(initializerName: string, codeId: number, moduleId: number, profiler: Profiler) {
    super(initializerName, codeId, moduleId);
    this.profiler = profiler;
  }

  // 引数が違うだけ、要削除
  functionBodyDeclaration2(node: AST.FunctionDeclaration | AST.ArrowFunctionExpression,
                           funcName: string, bodyName: string, env: VariableEnv,
                           funcInfo?: VariableInfo, isStatic: boolean = true): FunctionEnv {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    fenv.allocateRootSet()
    const funcType = getStaticType(node) as FunctionType;

    const prevResult = this.result
    this.result = this.declarations
    if (isStatic)
      this.functionBody(node, fenv, funcType, bodyName)
    else
      this.functionBody(node, fenv, funcType, bodyName, '')   // not a static function

    this.result = prevResult

    if (fenv.isFreeVariable(funcInfo))
      this.result.nl().write(`${funcName}.${cr.functionPtr} = ${bodyName};`).nl()
    else {
      this.signatures += this.makeFunctionStruct(funcName, funcType, false)
      this.declarations.write(`${cr.funcStructInC} ${funcName} = { ${bodyName}, "${encodeType(funcType)}" };`).nl()
    }

    return fenv
  }

  functionDeclaration(node: FunctionDeclaration, env: VariableEnv) {
    const fname = (node.id as AST.Identifier).name
    const funcInfo = env.table.lookup(fname)
    if (fname.startsWith(specializedFuncPrefix)) {
      const _fname = fname.slice(specializedFuncPrefix.length);
      const transpiledFuncName = funcInfo ? funcInfo.transpiledName(_fname) : _fname;
      const specializedFuncName = specializedFunctionName(transpiledFuncName);
      const specializedFuncBodyName = specializedFunctionBodyName(transpiledFuncName);
      this.functionBodyDeclaration2(node, specializedFuncName, specializedFuncBodyName, env, funcInfo);
      return
    } else {
      const transpiledFuncName = funcInfo ? funcInfo.transpiledName(fname) : fname;
      const wrapperFuncName = transpiledFuncName
      const wrapperBodyName = cr.functionBodyName(transpiledFuncName)
      const specializedFuncName = specializedFunctionName(transpiledFuncName);
      const originalFuncName = originalFunctionName(transpiledFuncName);
      const funcProfile = this.profiler.getFunctionProfileByName(fname);
      if (funcProfile === undefined)
        throw new Error('Fatal: function profile does not exist.')
      this.wrapperFunctionDeclaration(node, wrapperFuncName, wrapperBodyName, originalFuncName, specializedFuncName, funcProfile, env)
    }
  }

  private wrapperFunctionDeclaration(node: AST.FunctionDeclaration,
                                     wrapperFuncName: string, wrapperBodyName: string, originalFuncName: string, specializedFuncName: string,
                                     funcProfile: FunctionProfile, env: VariableEnv, isStatic: boolean = true): FunctionEnv {
    const fenv = new FunctionEnv(getVariableNameTable(node), env)
    const funcType = getStaticType(node) as FunctionType;
    const prevResult = this.result
    this.result = this.declarations
    if (isStatic)
      this.wrapperFunctionBody(node, originalFuncName, specializedFuncName, fenv, funcType, wrapperBodyName, funcProfile)
    else
      this.wrapperFunctionBody(node, originalFuncName, specializedFuncName, fenv, funcType, wrapperBodyName, funcProfile, '')
    this.result = prevResult

    this.result.nl().write(`${wrapperFuncName}.${cr.functionPtr} = ${wrapperBodyName};`).nl()
    this.signatures += this.makeFunctionStruct(originalFuncName, funcType, false);
    return fenv
  }


  private wrapperFunctionBody(node: AST.FunctionDeclaration, originalFuncName: string, specializedFuncName: string,
                              fenv: FunctionEnv, funcType: FunctionType, bodyName: string, funcProfile: FunctionProfile,
                              modifier: string = 'static ') {
    const bodyResult = this.result.copy()
    const sig = this.makeParameterList(funcType, node, fenv, bodyResult)
    this.result.write(`${modifier}${cr.typeToCType(funcType.returnType, bodyName)}${sig}`).write(' {')
    this.result.right().nl();

    if (funcProfile.specializedType === undefined)
      throw new Error('fatal there is no specialized type');

    this.result.write('if (')
    {
      let paramSig:string[] = [];
      for (let i = 0; i < funcType.paramTypes.length; i++) {
        const paramName = (node.params[i] as AST.Identifier).name
        const info = fenv.table.lookup(paramName)
        if (info !== undefined) {
          const check = checkType(funcProfile.specializedType.paramTypes[i]);
          if (check) {
            const name = info.transpiledName(paramName)
            paramSig.push(`${check}${name})`);
          }
        }
      }
      this.result.write(paramSig.join(' && '))
    }
    this.result.write(') {')
    this.result.right().nl()

    // call specialized
    {
      this.result.write('return ');
      const ftype = cr.funcTypeToCType(funcProfile.specializedType)
      this.result.write(`((${ftype})${specializedFuncName}.${cr.functionPtr})(`)
      let paramSig = ['self']
      for (let i = 0; i < funcType.paramTypes.length; i++) {
        const paramName = (node.params[i] as AST.Identifier).name
        const info = fenv.table.lookup(paramName)
        if (info !== undefined) {
          const name = info.transpiledName(paramName)
          paramSig.push(`${typeConversion(funcProfile.type.paramTypes[i], funcProfile.specializedType.paramTypes[i], node)}${name})`);
        }
      }
      this.result.write(paramSig.join(', ')).write(');');
    }

    this.result.left().nl()
    this.result.write('} else {')
    this.result.right().nl()

    {
      // call original
      this.result.write('return ');
      const ftype = cr.funcTypeToCType(funcType)
      this.result.write(`((${ftype})${originalFuncName}.${cr.functionPtr})(`)
      let paramSig = ['self']
      for (let i = 0; i < funcType.paramTypes.length; i++) {
        const paramName = (node.params[i] as AST.Identifier).name
        const info = fenv.table.lookup(paramName)
        if (info !== undefined) {
          const name = info.transpiledName(paramName)
          paramSig.push(name)
        }
      }
      this.result.write(paramSig.join(', ')).write(');');
    }

    this.result.left().nl()
    this.result.write('}')

    this.result.left().nl();
    this.result.write('}').nl();
  }
}
