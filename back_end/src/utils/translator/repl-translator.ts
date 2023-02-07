import {FunctionTypeModel, SymbolModel, VariableTypeModel} from "../../models/symbol-model";
import {isDeclaration, isFile, Node} from "@babel/types";
import BlockEnv from "./env";
import * as babelParser from "@babel/parser";
import generateCString from "./generate-c-string";

export default class ReplTranslator {
  private readonly tsString:string;
  private readonly alreadyExistSymbolNames:string[];
  private readonly blockEnv: BlockEnv;


  constructor(tsString: string, definedSymbols:  {[p: string]: FunctionTypeModel | VariableTypeModel}) {
    this.tsString = tsString;
    this.alreadyExistSymbolNames = Object.keys(definedSymbols);
    this.blockEnv = new BlockEnv(undefined, definedSymbols);
  }

  public translate():{cString: string, newDefinedSymbols:SymbolModel[], execFuncNames: string[]} {
    let cString = "";
    const execFuncNames:string[] = [];
    // To string.
    const fileNode = babelParser.parse(this.tsString, {plugins: ["typescript"]});
    const groupedStatements = this.generateGroupedStatements(fileNode);
    groupedStatements.forEach(statements => {
      if (statements.isSymbolDeclaration) {
        cString += generateCString(statements.statements[0], this.blockEnv);
        cString += ";\n";
      } else {
        const randomFunctionName = this.generateRandomFunctionName();
        execFuncNames.push(randomFunctionName);
        cString += `void ${randomFunctionName}() {\n`;
        statements.statements.forEach(statement => {
          // function内ではあるが、シンボル宣言はないことと、他の関数と同様に扱いたくないことから、this.blockEnvをそのまま使う。
          cString += generateCString(statement, this.blockEnv);
          cString += ";\n";
        });
        cString += "};\n";
      }
    });

    const newDefinedSymbols = this.generateNewDefinedSymbols();
    return {cString, newDefinedSymbols, execFuncNames}
  }

  private generateGroupedStatements(fileNode: Node):{statements:Node[], isSymbolDeclaration: boolean}[] {
    if (!isFile(fileNode)) {
      throw Error("Unknown node passed.");
    }
    const programBody = fileNode.program.body;
    const groupedNodes:{statements:Node[], isSymbolDeclaration: boolean}[] = [];
    programBody.forEach(statement => {
      if (isDeclaration(statement)) {
        groupedNodes.push({statements: [statement], isSymbolDeclaration: true});
      } else if (groupedNodes.length === 0 || groupedNodes[groupedNodes.length - 1].isSymbolDeclaration) {
        groupedNodes.push({statements: [statement], isSymbolDeclaration: false});
      } else {
        groupedNodes[groupedNodes.length - 1].statements.push(statement);
      }
    });
    return groupedNodes;
  }

  private generateRandomFunctionName():string {
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const functionNameLength = 10
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < functionNameLength; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  private generateNewDefinedSymbols():SymbolModel[] {
    const alreadyExistSymbolNames = new Set(this.alreadyExistSymbolNames);
    const envSymbols = this.blockEnv.getSymbolTable();
    const newSymbols:SymbolModel[] = [];
    for(const [name, type] of Object.entries(envSymbols)) {
      if (!alreadyExistSymbolNames.has(name)) {
        if (type.symbolType === "variable") {
          newSymbols.push({name,type,access: "public",declaration: `value_t ${name};`})
        } else if (type.symbolType === "function") {
          newSymbols.push({name, access: "public", declaration: this.generateFunctionDeclaration(name, type), type});
        }
      }
    }
    return newSymbols;
  }

  private generateFunctionDeclaration(name: string, functionType: FunctionTypeModel): string {
    let declaration = functionType.returnType === "void" || !functionType.returnType ? "void" : "value_t";
    declaration += ` ${name}(`;
    if (functionType.params.length) {
      functionType.params.forEach(param => {declaration += `value_t ${param.name}, `});
      declaration = declaration.slice(0, -2);
    }
    declaration += ");";
    return declaration;
  }
}