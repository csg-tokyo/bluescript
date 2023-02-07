import AvailableType from "../../models/available-type";
import {FunctionTypeModel, VariableTypeModel} from "../../models/symbol-model";


export default class BlockEnv {
  private readonly prev: BlockEnv|undefined
  private readonly symbolTable: {[name: string]: FunctionTypeModel | VariableTypeModel} = {}

  constructor(prev?: BlockEnv, symbolTable?: {[name: string]: FunctionTypeModel | VariableTypeModel}) {
    this.prev = prev;
    this.symbolTable = symbolTable ? symbolTable : {};
  }

  public getSymbolTable():{[name: string]: FunctionTypeModel | VariableTypeModel} {
    return this.symbolTable;
  }

  public addVariable(name: string, type: AvailableType) {
    if (this.symbolTable[name]) {
      throw Error("The passed symbol already exists in the symbol table. Symbol name: " + name);
    }
    this.symbolTable[name] = {symbolType: "variable", variableType: type};
  }

  public addFunction(name: string, params: {name: string, type: AvailableType}[], returnType: AvailableType) {
    if (this.symbolTable[name]){
      throw Error("The passed symbol already exists in the symbol table. Symbol name: " + name);
    }
    this.symbolTable[name] = { symbolType: "function", params, returnType};
  }

  public getSymbol(name: string): FunctionTypeModel | VariableTypeModel {
    const symbol = this.symbolTable[name];
    if (!symbol) {
      if (!this.prev) {
        throw Error("Could not find the symbol. The symbol name is " + name);
      }
      return this.prev.getSymbol(name);
    }
    return symbol;
  }

  public getVariables(): {name: string, variableType: AvailableType}[] {
    const variables: {name: string, variableType: AvailableType}[] = [];
    for (const name of Object.keys(this.symbolTable)) {
      const variable = this.symbolTable[name];
      if (variable.symbolType === "variable") {
        variables.push({name, variableType: variable.variableType})
      }
    }
    return variables;
  }

  public getFunction(name: string): FunctionTypeModel {
    const symbol = this.getSymbol(name);
    if (symbol.symbolType === "variable") {
      throw Error("The found symbol is not variable. The symbol name is " + name);
    }
    return symbol;
  }
}

export class FuncBlockEnv extends BlockEnv {
  private variableNames: string[] = [];

  public getVariableIndex(variableName: string):number {
    return  this.variableNames.findIndex(el => el === variableName);
  }

  override addVariable(name: string, type: AvailableType) {
    super.addVariable(name, type);
    this.variableNames.push(name)
  }
}