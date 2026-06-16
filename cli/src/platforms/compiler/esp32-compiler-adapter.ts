import { GlobalConfigHandler, Esp32BoardConfig } from "../../config/global-config";
import { ProjectConfigHandler, PROJECT_DEFAULT_PATHS } from "../../config/project-config";
import { BoardName } from "../../config/board-utils";
import {
    CompilerSession, MemoryImage, MemoryLayout,
    Esp32Toolchain, Esp32ToolchainConfig, ProjectForEsp32, PackageForEsp32
} from "@bscript/lang";
import { CompilerAdapter, CompileContext } from "./compiler-adapter";
import * as path from 'path';


const DUMMY_MEMORY_LAYOUT: MemoryLayout = {
    iram: { address: 0x40096c34, size: 1000000 },
    dram: { address: 0x3ffd5b1c, size: 1000000 },
    iflash: { address: 0x40150000, size: 1000000 },
    dflash: { address: 0x3f43a000, size: 1000000 },
};

export class Esp32CompilerAdapter implements CompilerAdapter {
    readonly boardName: BoardName = 'esp32';
    private boardConfig: Esp32BoardConfig;
    private compiler?: CompilerSession<ProjectForEsp32, MemoryImage>;

    constructor(
        private globalConfigHandler: GlobalConfigHandler,
        private projectConfigHandler: ProjectConfigHandler,
    ) {
        const boardConfig = this.globalConfigHandler.getBoardConfig('esp32');
        if (boardConfig === undefined) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
        this.boardConfig = boardConfig;
    }

    async buildForCheck(): Promise<MemoryImage> {
        return this.buildProject({ memoryLayout: DUMMY_MEMORY_LAYOUT });
    }

    async buildProject(context?: CompileContext): Promise<MemoryImage> {
        const memoryLayout = context?.memoryLayout;
        if (!memoryLayout) {
            throw new Error('Memory layout is required to build an ESP32 project.');
        }
        const project = ProjectForEsp32.load(
            this.projectConfigHandler.getConfig().projectName,
            createEsp32PackageReader(this.boardName, this.projectConfigHandler),
        );
        const toolchain = new Esp32Toolchain(this.getCompilerConfig(), memoryLayout);
        this.compiler = new CompilerSession(toolchain);
        return this.compiler.buildProject(project);
    }

    async compileFragment(src: string): Promise<MemoryImage> {
        if (!this.compiler) {
            throw new Error("Cannot compile fragment before building the project.");
        }
        return this.compiler.compileFragment(src);
    }

    private getCompilerConfig(): Esp32ToolchainConfig {
        const runtimeDir = this.projectConfigHandler.getConfig().runtimeDir
            ?? this.globalConfigHandler.getConfig().runtimeDir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }
        return {
            runtimeDir,
            compilerToolchainDir: this.boardConfig.xtensaGccDir,
            espDir: this.boardConfig.rootDir,
        };
    }
}

export function createEsp32PackageReader(
    _boardName: BoardName,
    projectConfigHandler: ProjectConfigHandler,
): (name: string) => PackageForEsp32 {
    return (name: string) => {
        const mainRoot = projectConfigHandler.root;
        const subPackageRoot = path.join(mainRoot, PROJECT_DEFAULT_PATHS.PACKAGES_DIR, name);
        const isMain = name === projectConfigHandler.getConfig().projectName;
        const root = isMain ? mainRoot : subPackageRoot;
        try {
            const configHandler = isMain
                ? projectConfigHandler.asBoard('esp32')
                : ProjectConfigHandler.load(root).asBoard('esp32');
            return new PackageForEsp32(
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
                configHandler.espIdfComponents,
            );
        } catch (error) {
            throw new Error(`Failed to read ${name}.`, { cause: error });
        }
    };
}