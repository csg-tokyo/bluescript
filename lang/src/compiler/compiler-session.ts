import { BoardToolchain, CompileOutput } from "./board-toolchain/board-toolchain";
import { Project } from "./project";
import { TranspilerSession } from "./transpiler-session";

export class CompilerSession<P extends Project, Output extends CompileOutput> {
    private transpiler: TranspilerSession;
    private toolchain: BoardToolchain<P, Output>;
    private project: P | null = null;

    constructor(toolchain: BoardToolchain<P, Output>) {
        this.transpiler = new TranspilerSession(toolchain.builtinModulePath, toolchain.cProlog);
        this.toolchain = toolchain;
    }

    public async buildProject(project: P): Promise<Output> {
        this.project = project;

        project.check();
        project.clean();

        const entryPoints = this.transpiler.transpile(project);
        return this.toolchain.compileAndLink(project, entryPoints);
    }

    public async compileFragment(src: string): Promise<Output> {
        if (!this.project) {
            throw new Error("Cannot compile fragment before building the workspace.");
        }

        const entryPoints = this.transpiler.transpileFragment(this.project, src);
        return this.toolchain.additionalCompileAndLink(this.project, entryPoints);
    }
}

