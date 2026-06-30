import { GlobalConfigHandler } from "../../config/global-config";
import { ProjectConfigHandler, PROJECT_DEFAULT_PATHS } from "../../config/project-config";
import { BoardName } from "../../config/board-utils";
import {
    CompilerSession, SharedLibrary,
    HostUnixToolchain, Project, PackageForHostUnix
} from "@bscript/lang";
import { CompilerAdapter, CompileContext } from "./compiler-adapter";
import * as path from 'path';


export class HostCompilerAdapter implements CompilerAdapter {
    readonly boardName: BoardName = 'host';
    private compiler?: CompilerSession<PackageForHostUnix, SharedLibrary>;

    constructor(
        private globalConfigHandler: GlobalConfigHandler,
        private projectConfigHandler: ProjectConfigHandler,
    ) {
        if (!this.globalConfigHandler.isBoardSetup(this.boardName)) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
    }

    async buildForCheck(): Promise<SharedLibrary> {
        return this.buildProject();
    }

    async buildProject(_context?: CompileContext): Promise<SharedLibrary> {
        const project = Project.load<PackageForHostUnix>(
            this.projectConfigHandler.getConfig().projectName,
            createHostPackageReader(this.boardName, this.projectConfigHandler),
        );
        const toolchain = new HostUnixToolchain(this.getRuntimeDir());
        this.compiler = new CompilerSession(toolchain);
        return this.compiler.buildProject(project);
    }

    async compileFragment(src: string): Promise<SharedLibrary> {
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

export function createHostPackageReader(
    _boardName: BoardName,
    projectConfigHandler: ProjectConfigHandler,
): (name: string) => PackageForHostUnix {
    return (name: string) => {
        const mainRoot = projectConfigHandler.root;
        const subPackageRoot = path.join(mainRoot, PROJECT_DEFAULT_PATHS.PACKAGES_DIR, name);
        const isMain = name === projectConfigHandler.getConfig().projectName;
        const root = isMain ? mainRoot : subPackageRoot;
        try {
            const configHandler = isMain
                ? projectConfigHandler.asBoard('host')
                : ProjectConfigHandler.load(root).asBoard('host');
            return new PackageForHostUnix(
                name,
                {
                    rootDir: root,
                    entry: configHandler.entryFile ?? PROJECT_DEFAULT_PATHS.ENTRY_FILE,
                    sourceDir: configHandler.srcDir ?? PROJECT_DEFAULT_PATHS.SRC_DIR,
                    distDir: PROJECT_DEFAULT_PATHS.DIST_DIR,
                    buildDir: PROJECT_DEFAULT_PATHS.BUILD_DIR,
                    packageDir: PROJECT_DEFAULT_PATHS.PACKAGES_DIR,
                },
                Object.keys(configHandler.dependencies),
            );
        } catch (error) {
            throw new Error(`Failed to read ${name}.`, { cause: error });
        }
    };
}
