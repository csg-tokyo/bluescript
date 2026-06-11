import { BoardToolchain, CompileOutput } from "./board-toolchain/board-toolchain";
import { Package, Project } from "./project";
import { TranspilerSession } from "./transpiler-session";

export class CompilerSession<P extends Project, Output extends CompileOutput> {
    private transpiler: TranspilerSession;
    private toolchain: BoardToolchain<P, Output>;
    private currentProject: P | null = null;

    constructor(toolchain: BoardToolchain<P, Output>) {
        this.transpiler = new TranspilerSession(toolchain.builtinModulePath, toolchain.cProlog);
        this.toolchain = toolchain;
    }

    public async buildProject(project: P): Promise<Output> {
        this.currentProject = project;

        project.check();
        project.clean();

        const entryPoints = this.transpiler.transpile(project);
        return this.toolchain.compileAndLink(project, entryPoints);
    }

    public async compileFragment(src: string): Promise<Output> {
        if (!this.currentProject) {
            throw new Error("Cannot compile fragment before building the workspace.");
        }

        const entryPoints = this.transpiler.transpileFragment(this.currentProject, src);
        return this.toolchain.additionalCompileAndLink(this.currentProject, entryPoints);
    }
}

