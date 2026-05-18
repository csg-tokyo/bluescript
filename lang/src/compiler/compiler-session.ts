import { BoardToolchain, ExecutableBinary } from "./board-toolchain/board-toolchain";
import { Package, Project } from "./project";
import { TranspilerSession } from "./transpiler-session";

export class CompilerSession<P extends Package = Package> {
    private transpiler: TranspilerSession;
    private toolchain: BoardToolchain;
    private currentProject: Project<P> | null = null;

    constructor(toolchain: BoardToolchain<P>) {
        this.transpiler = new TranspilerSession(toolchain.builtinModulePath, toolchain.cProlog);
        this.toolchain = toolchain;
    }

    public async buildProject(project: Project<P>): Promise<ExecutableBinary> {
        this.currentProject = project;

        project.check();
        project.clean();

        const entryPoints = this.transpiler.transpile(project);
        const allPackages = [project.mainPackage, ...project.dependencies];
        for (const pkg of allPackages) {
            await this.toolchain.compileC(project, pkg);
        }
        const elfPath = await this.toolchain.link(project, entryPoints);
        return this.toolchain.extractBinary(elfPath, entryPoints);
    }

    public async compileFragment(src: string): Promise<ExecutableBinary> {
        if (!this.currentProject) {
            throw new Error("Cannot compile fragment before building the workspace.");
        }

        const entryPoints = this.transpiler.transpileFragment(this.currentProject, src);
        await this.toolchain.compileC(this.currentProject, this.currentProject.mainPackage);
        const elfPath = await this.toolchain.link(this.currentProject, entryPoints);
        return this.toolchain.extractBinary(elfPath, entryPoints);
    }
}

