import { GlobalConfigHandler } from "../../config/global-config";
import { ProjectConfigHandler } from "../../config/project-config";
import { BoardName } from "../../config/board-utils";
import {
    CompilerSession, SharedObject,
    HostToolchain, ProjectForHost
} from "@bscript/lang";
import { CompilerAdapter, CompileContext } from "./compiler-adapter";
import { createHostPackageReader } from "./host-package-reader";

export class HostCompilerAdapter implements CompilerAdapter {
    readonly boardName: BoardName = 'host';
    private compiler?: CompilerSession<ProjectForHost, SharedObject>;

    constructor(
        private globalConfigHandler: GlobalConfigHandler,
        private projectConfigHandler: ProjectConfigHandler,
    ) {
        if (!this.globalConfigHandler.isBoardSetup(this.boardName)) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
    }

    async buildForCheck(): Promise<SharedObject> {
        return this.buildProject();
    }

    async buildProject(_context?: CompileContext): Promise<SharedObject> {
        const project = ProjectForHost.load(
            this.projectConfigHandler.getConfig().projectName,
            createHostPackageReader(this.boardName, this.projectConfigHandler),
        );
        const toolchain = new HostToolchain(this.getRuntimeDir());
        this.compiler = new CompilerSession(toolchain);
        return this.compiler.buildProject(project);
    }

    async compileFragment(src: string): Promise<SharedObject> {
        if (!this.compiler) {
            throw new Error("Cannot compile fragment before building the project.");
        }
        return this.compiler.compileFragment(src);
    }

    private getRuntimeDir(): string {
        const runtimeDir = this.projectConfigHandler.getConfig().runtimeDir
            ?? this.globalConfigHandler.getConfig().runtimeDir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }
        return runtimeDir;
    }
}
