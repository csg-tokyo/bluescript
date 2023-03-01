import {CodeGenerator, staticTypeToCType} from "./code-generator";
import * as AST from '@babel/types';
import {Identifier} from "@babel/types";
import {GCNewString, GlobalRootSet, RootSet} from "./root-set";
import {isValueT} from "../types";


export class ReplGlobalRootSet extends GlobalRootSet {
  private readonly EXEC_FUNC_NAME_PREFIX = "___bluescript_exec_func_"
  execFunctionNames:string[] = [];

  generateExecFuncName():string {
    const name = this.EXEC_FUNC_NAME_PREFIX + this.execFunctionNames.length;
    this.execFunctionNames.push(name);
    return name;
  }
}

export class ReplCodeGenerator extends CodeGenerator {
  override program(node: AST.Program, env: RootSet) {
    const replEnv = env as ReplGlobalRootSet;
    const groupedNodes = this.groupedNodes(node.body);
    for (const group of groupedNodes) {
      if (group.isDeclaration) {
        this.visit(group.nodes[0], env);
        if (AST.isFunctionDeclaration(group.nodes[0]))
          this.result += ";\n";
      } else {
        this.result += `void ${replEnv.generateExecFuncName()} {\n`;
        for (const statement of group.nodes) {
          this.visit(statement, env);
          this.result += ";\n";
        }

        this.result += "};\n";
      }
    }
    this.result += "\n";
  }

  override variableDeclarator(node: AST.VariableDeclarator, env: RootSet) {
    if (!(env instanceof ReplGlobalRootSet)) {
      super.variableDeclarator(node, env);
      return;
    }
    const replEnv = env as ReplGlobalRootSet;
    const varName = (node.id as Identifier).name
    const varType = replEnv.nameTable?.lookup(varName)?.type;
    this.result += staticTypeToCType(varType) + " ";
    this.result += varName;
    this.result += ";\n";
    if (node.init) {
        this.result += `void ${replEnv.generateExecFuncName()} {\n`;
        this.result += `${varName} = `
        this.visit(node.init, env);
        if (isValueT(varType)) {
          this.result += ";\n";
          this.result += (env as GlobalRootSet).generateSetStatement(varName);
        }
        this.result += ";\n};\n";
    }
  }

  private groupedNodes(nodes:AST.Node[]): {nodes:AST.Node[], isDeclaration: boolean}[] {
    const groupedNodes:{nodes:AST.Node[], isDeclaration: boolean}[] = [];
    nodes.forEach(node => {
      if (AST.isDeclaration(node)) {
        groupedNodes.push({nodes: [node], isDeclaration: true});
      } else if (groupedNodes.length === 0 || groupedNodes[groupedNodes.length - 1].isDeclaration) {
        groupedNodes.push({nodes: [node], isDeclaration: false});
      } else {
        groupedNodes[groupedNodes.length - 1].nodes.push(node);
      }
    });
    return groupedNodes;
  }
}