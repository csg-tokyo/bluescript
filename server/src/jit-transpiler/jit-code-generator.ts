import {CodeGenerator} from "../transpiler/code-generator/code-generator";
import {
  callCounterName,
  FunctionProfile, maxParamNum, profileFunctionName,
  Profiler, typeProfilerName
} from "./profiler";
import {
  FunctionEnv,
  getVariableNameTable, GlobalEnv,
  GlobalVariableNameTable,
  VariableEnv,
  VariableNameTableMaker
} from "../transpiler/code-generator/variables";
import * as AST from "@babel/types";
import {
  Any,
  ArrayType,
  BooleanT,
  encodeType,
  Float,
  FunctionType,
  Integer,
  StaticType,
  StringT
} from "../transpiler/types";
import {FunctionDeclaration} from "@babel/types";
import * as cr from "../transpiler/code-generator/c-runtime";
import {getStaticType, NameInfo, NameTableMaker} from "../transpiler/names";
import {jitTypecheck, JitTypeChecker} from "./jit-type-checker";
import {getSpecializedNode, ProfileError} from "./utils";
import {InstanceType} from "../transpiler/classes";
import {classNameInC} from "../transpiler/code-generator/c-runtime";


export function jitTranspile(codeId: number, ast: AST.Node,
                             typeChecker: (maker: NameTableMaker<NameInfo>) => JitTypeChecker<NameInfo>,
                             codeGenerator: (initializerName: string, codeId: number, moduleId: string) => JitCodeGenerator,
                             gvnt?: GlobalVariableNameTable,
                             moduleId: number | string = -1,
                             startLine: number = 1, header: string = '') {
  const moduleName = typeof moduleId === 'number' && moduleId < 0 ? '' : `${moduleId}`
  const maker = new VariableNameTableMaker(moduleName)
  const nameTable = new GlobalVariableNameTable(gvnt)
  jitTypecheck(ast, maker, nameTable, typeChecker(maker))
  const nullEnv = new GlobalEnv(new GlobalVariableNameTable(), cr.globalRootSetName)
  const mainFuncName = `${cr.mainFunctionName}${codeId}_${moduleName}`
  const generator = codeGenerator(mainFuncName, codeId, moduleName)
  generator.visit(ast, nullEnv)   // nullEnv will not be used.
  if (generator.errorLog.hasError())
    throw generator.errorLog
  else
    return { code: generator.getCode(header),
      main: mainFuncName, names: nameTable }
}

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
function checkType(env: VariableEnv, type?: StaticType): string|undefined {
  if (type instanceof ArrayType) {
    if (type.elementType === Integer)
      return 'gc_is_intarray(';
    if (type.elementType === Float)
      return 'gc_is_floatarray(';
    if (type.elementType === BooleanT)
      return 'gc_is_boolarray(';
    if (type.elementType === Any)
      return 'gc_is_anyarray(';
    else
      return `gc_is_instance_of(&${env.useArrayType(type)[0]}.clazz, `;
  }

  if (type instanceof InstanceType) {
    return `gc_is_instance_of(&${classNameInC(type.name())}.clazz, `;
  }

  switch (type) {
    case Integer:
      return 'is_int_value(';
    case Float:
      return 'is_float_value(';
    case BooleanT:
      return 'is_bool_value(';
    case StringT:
      return 'gc_is_string_object(';
    default:
      return undefined;
  }
}

export class JitCodeGenerator extends CodeGenerator{
  private profiler: Profiler;
  private bsSrc: string[];


  constructor(initializerName: string, codeId: number, moduleId: string, profiler: Profiler, src: string) {
    super(initializerName, codeId, moduleId);
    this.profiler = profiler;
    this.bsSrc = src.split('\n');
  }

  functionDeclaration(node: AST.FunctionDeclaration, env: VariableEnv) {
    const name = (node.id as AST.Identifier).name
    const funcInfo = env.table.lookup(name)
    const funcType = getStaticType(node) as FunctionType;
    const funcName = funcInfo ? funcInfo.transpiledName(name) : name
    const fenv = new FunctionEnv(getVariableNameTable(node), env)

    if (!Profiler.funcNeedsProfiling(funcType)) {
      super.functionDeclaration(node, env);
      return;
    }

    let funcProfile = this.profiler.getFunctionProfileByName(name);
    if (funcProfile === undefined) {
      const src = this.bsSrc.slice((node.loc?.start.line ?? 0) - 1, node.loc?.end.line).join('\n');
      funcProfile = this.profiler.setFunctionProfile(name, src, funcType)
    }
    const originalFuncName = originalFunctionName(funcName)
    const originalFuncBodyName = originalFunctionBodyName(funcName)
    const specializedFuncName = specializedFunctionName(funcName);
    const specializedFuncBodyName = specializedFunctionBodyName(funcName);

    switch (funcProfile.state.state) {
      case 'profiling':
        const isFreeVariable = fenv.isFreeVariable(funcInfo)
        this.functionBodyDeclaration2(node, originalFuncName, originalFuncBodyName, fenv, isFreeVariable)
        if (!isFreeVariable)
          this.wrapperFunctionBodyDeclaration(node, funcName, false, funcProfile, fenv)
        break
      case 'specializing': {
        const specializedNode = getSpecializedNode(node);
        if (specializedNode === undefined)
          throw new ProfileError(`Cannot find specialized node. Node: ${node}`)
        const specializedFenv = new FunctionEnv(getVariableNameTable(specializedNode), env)
        this.functionBodyDeclaration2(specializedNode, specializedFuncName, specializedFuncBodyName, specializedFenv, false)
        this.wrapperFunctionBodyDeclaration(node, funcName, true, funcProfile, fenv)
        this.profiler.setFunctionState(name, {state: 'specialized', type: funcProfile.state.type})
        break
      }
      case 'undoing':
        this.signatures += this.makeFunctionStruct(funcName, funcType, false)
        this.signatures += `extern ${cr.typeToCType(funcType.returnType, originalFuncBodyName)}${super.makeSimpleParameterList(funcType)};\n`
        this.result.nl().write(`${funcName}.${cr.functionPtr} = ${originalFuncBodyName};`).nl()
        this.profiler.setFunctionState(name, {state: 'unspecialized'})
        break
      case 'specialized': {
        const specializedNode = getSpecializedNode(node);
        if (specializedNode === undefined)
          throw new ProfileError(`Cannot find specialized node. Node: ${node}`)
        const specializedFenv = new FunctionEnv(getVariableNameTable(specializedNode), env)
        this.functionBodyDeclaration2(specializedNode, specializedFuncName, specializedFuncBodyName, specializedFenv, true)
        this.functionBodyDeclaration2(node, originalFuncName, originalFuncBodyName, fenv, true)
        break
      }
      case 'unspecialized':
        this.functionBodyDeclaration2(node, funcName, cr.functionBodyName(funcName), fenv, true)
        break
    }
  }

  private functionBodyDeclaration2(node: AST.FunctionDeclaration, funcName: string, bodyName: string, fenv: FunctionEnv,
                           isFreeVariable: boolean) {
    fenv.allocateRootSet()
    const funcType = getStaticType(node) as FunctionType;

    const prevResult = this.result
    this.result = this.declarations
    this.functionBody(node, fenv, funcType, bodyName)
    this.result = prevResult

    this.signatures += this.makeFunctionStruct(funcName, funcType, false)
    if (isFreeVariable) {
      this.result.nl().write(`${funcName}.${cr.functionPtr} = ${bodyName};`).nl()
    } else {
      this.declarations.write(`${cr.funcStructInC} ${funcName} = { ${bodyName}, "${encodeType(funcType)}" };`).nl()
    }
  }

  private wrapperFunctionBodyDeclaration(node: AST.FunctionDeclaration, funcName: string, isFreeVariable: boolean,
                                     funcProfile: FunctionProfile, fenv: FunctionEnv) {
    const funcType = getStaticType(node) as FunctionType;
    const wrapperFuncName = funcName
    const wrapperBodyName = cr.functionBodyName(funcName)

    const prevResult = this.result
    this.result = this.declarations
    if (funcProfile.state.state === 'profiling')
      this.wrapperFunctionBodyForProfiling(node, fenv, funcType, funcName, funcProfile.id)
    else if (funcProfile.state.state === 'specializing')
      this.wrapperFunctionBodyForSpecializing(node, fenv, funcType, funcName, funcProfile.state.type)
    this.result = prevResult

    this.signatures += this.makeFunctionStruct(wrapperFuncName, funcType, false)
    if (isFreeVariable) {
      this.result.nl().write(`${funcName}.${cr.functionPtr} = ${wrapperBodyName};`).nl()
    } else {
      this.declarations.write(`${cr.funcStructInC} ${wrapperFuncName} = { ${wrapperBodyName}, "${encodeType(funcType)}" };`).nl()
    }
  }

  private wrapperFunctionBodyForProfiling(node: AST.FunctionDeclaration, fenv: FunctionEnv,
                                          funcType: FunctionType, funcName: string, funcProfileId: number,
                                          modifier: string = 'static ') {
    const wrapperBodyName = cr.functionBodyName(funcName)
    const originalFuncName = originalFunctionName(funcName)
    const bodyResult = this.result.copy()
    const sig = this.makeParameterList(funcType, node, fenv, bodyResult)
    this.result.write(`${modifier}${cr.typeToCType(funcType.returnType, wrapperBodyName)}${sig}`).write(' {')
    this.result.right().nl();

    this.functionProfiling(node, fenv, funcType, funcProfileId);

    this.result.write('return ');
    this.functionCall(node, fenv, originalFuncName, funcType, funcType.paramTypes, 'self')
    this.result.left().nl();
    this.result.write('}').nl();
  }

  private wrapperFunctionBodyForSpecializing(node: AST.FunctionDeclaration, fenv: FunctionEnv,
                                             funcType: FunctionType, funcName: string, specializedType: FunctionType,
                                             modifier: string = 'static ') {
    const wrapperBodyName = cr.functionBodyName(funcName)
    const originalFuncName = originalFunctionName(funcName)
    const specializedFuncName = specializedFunctionName(funcName)
    const bodyResult = this.result.copy()
    const sig = this.makeParameterList(funcType, node, fenv, bodyResult)
    this.result.write(`${modifier}${cr.typeToCType(funcType.returnType, wrapperBodyName)}${sig}`).write(' {')
    this.result.right().nl();

    this.result.write('if (')
    this.parameterCheck(node, fenv, funcType.paramTypes, specializedType.paramTypes)
    this.result.write(') {')
    this.result.right().nl()

    // For test
    this.result.write(`#ifdef TEST64`).nl().write('puts("Execute specialized function");').nl().write('#endif').nl()

    this.result.write('return ');
    this.functionCall(node, fenv, specializedFuncName, specializedType, funcType.paramTypes, 'self')

    this.result.left().nl()
    this.result.write('} else {')
    this.result.right().nl()

    // For test
    this.result.write(`#ifdef TEST64`).nl().write('puts("Execute original function");').nl().write('#endif').nl()

    this.result.write('return ');
    this.functionCall(node, fenv, originalFuncName, funcType, funcType.paramTypes, 'self')
    this.signatures += this.makeFunctionStruct(originalFuncName, funcType, false)

    this.result.left().nl()
    this.result.write('}')

    this.result.left().nl();
    this.result.write('}').nl();
  }

  private functionProfiling(node: FunctionDeclaration, fenv: FunctionEnv, funcType: FunctionType, funcProfilerId:number) {
    this.result.write(`static uint8_t ${callCounterName} = 0;`).nl();
    this.result.write(`static typeint_t* ${typeProfilerName} = 0;`).nl();
    this.result.write(`${profileFunctionName}(`)
    let profSig = `${funcProfilerId}, &${callCounterName}, &${typeProfilerName}`;
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
    profSig += `, VALUE_UNDEF`.repeat(maxParamNum - c);
    this.result.write(profSig).write(');').nl();
  }

  private functionCall(node: AST.FunctionDeclaration, fenv: FunctionEnv, funcName: string, funcType: FunctionType,
                       argTypes: StaticType[], firstArg?: string) {
    const ftype = cr.funcTypeToCType(funcType)
    this.result.write(`((${ftype})${funcName}.${cr.functionPtr})(`)
    let paramSig = firstArg ? [firstArg] : [];
    for (let i = 0; i < funcType.paramTypes.length; i++) {
      const paramName = (node.params[i] as AST.Identifier).name
      const info = fenv.table.lookup(paramName)
      if (info !== undefined) {
        const name = info.transpiledName(paramName)
        paramSig.push(`${cr.typeConversion(argTypes[i], funcType.paramTypes[i], fenv, node)}${name})`);
      }
    }
    this.result.write(paramSig.join(', ')).write(');');
  }

  private parameterCheck(node: AST.FunctionDeclaration, fenv: FunctionEnv, srcParamTypes: StaticType[], targetParamTypes: StaticType[]) {
    let paramSig:string[] = [];
    for (let i = 0; i < srcParamTypes.length; i++) {
      const paramName = (node.params[i] as AST.Identifier).name
      const info = fenv.table.lookup(paramName)
      if (info !== undefined) {
        const check = checkType(fenv, targetParamTypes[i]);
        if (check) {
          const name = info.transpiledName(paramName)
          paramSig.push(`${check}${name})`);
        }
      }
    }
    this.result.write(paramSig.join(' && '))
  }
}