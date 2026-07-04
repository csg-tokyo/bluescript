import { GlobalConfigHandler, HostBoardConfig } from "../../config/global-config";
import { ProjectConfigHandler, PROJECT_DEFAULT_PATHS } from "../../config/project-config";
import { BoardName } from "../../config/board-utils";
import {
    CompilerSession, SharedLibrary,
    HostUnixToolchain, HostToolchainConfig, HostWindowsToolchain, Project, PackageForHostUnix, PackageForHostWindows
} from "@bscript/lang";
import { CompilerAdapter, CompileContext } from "./compiler-adapter";
import * as path from 'path';
import * as os from 'os';


type HostPackageClass = typeof PackageForHostUnix | typeof PackageForHostWindows;

export class HostCompilerAdapter implements CompilerAdapter {
    readonly boardName: BoardName = 'host';
    private boardConfig: HostBoardConfig;
    private compiler?: CompilerSession<PackageForHostUnix | PackageForHostWindows, SharedLibrary>;

    constructor(
        private globalConfigHandler: GlobalConfigHandler,
        private projectConfigHandler: ProjectConfigHandler,
    ) {
        const boardConfig = this.globalConfigHandler.getBoardConfig('host');
        if (boardConfig === undefined) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
        this.boardConfig = boardConfig;
    }

    async buildForCheck(): Promise<SharedLibrary> {
        return this.buildProject();
    }

    async buildProject(_context?: CompileContext): Promise<SharedLibrary> {
        const runtimeDir = this.getRuntimeDir();
        const compilerConfig: HostToolchainConfig = {
            runtimeDir,
            compilerToolchain: this.boardConfig.toolchain,
        };

        if (os.platform() === 'darwin') {
            const project = Project.load<PackageForHostUnix>(
                this.projectConfigHandler.getConfig().projectName,
                createHostPackageReader(this.projectConfigHandler, PackageForHostUnix),
            );
            const toolchain = new HostUnixToolchain(compilerConfig);
            this.compiler = new CompilerSession(toolchain);
            return this.compiler.buildProject(project);
        }

        if (os.platform() === 'win32') {
            const project = Project.load<PackageForHostWindows>(
                this.projectConfigHandler.getConfig().projectName,
                createHostPackageReader(this.projectConfigHandler, PackageForHostWindows),
            );
            const toolchain = new HostWindowsToolchain(compilerConfig);
            this.compiler = new CompilerSession(toolchain);
            return this.compiler.buildProject(project);
        }

        throw new Error('Unsupported OS.');
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

function createHostPackageReader<T extends HostPackageClass>(
    projectConfigHandler: ProjectConfigHandler,
    PackageClass: T,
): (name: string) => InstanceType<T> {
    return (name: string) => {
        const mainRoot = projectConfigHandler.root;
        const subPackageRoot = path.join(mainRoot, PROJECT_DEFAULT_PATHS.PACKAGES_DIR, name);
        const isMain = name === projectConfigHandler.getConfig().projectName;
        const root = isMain ? mainRoot : subPackageRoot;
        try {
            const configHandler = isMain
                ? projectConfigHandler.asBoard('host')
                : ProjectConfigHandler.load(root).asBoard('host');
            return new PackageClass(
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
            ) as InstanceType<T>;
        } catch (error) {
            throw new Error(`Failed to read ${name}.`, { cause: error });
        }
    };
}
