import { GlobalConfigHandler, Esp32BoardConfig } from "../config/global-config";
import { ProjectConfigHandler, PROJECT_PATHS } from "../config/project-config";
import { BoardName } from "../config/board-utils";
import { 
    CompilerSession, Project, ExecutableBinary, MemoryLayout,
    PackageForEsp32, Esp32Toolchain, Esp32ToolchainConfig
} from "@bscript/lang";
import * as path from 'path';


export interface CompilerAdapter {
    readonly boardName: BoardName;
    getDummyMemoryLayout(): MemoryLayout;
    buildProject(memoryLayout: MemoryLayout): Promise<ExecutableBinary>;
    compileFragment(src: string): Promise<ExecutableBinary>;
}

export class ESP32CompilerAdapter implements CompilerAdapter {
    readonly boardName: BoardName = 'esp32';
    private globalConfigHandler: GlobalConfigHandler;
    private projectConfigHandler: ProjectConfigHandler;
    private boardConfig: Esp32BoardConfig;
    private compiler?: CompilerSession;

    readonly dummyMemoryLayout: MemoryLayout = {
        iram: { address: 0x40096c34, size: 1000000 },
        dram: { address: 0x3ffd5b1c, size: 1000000 },
        iflash: { address: 0x40150000, size: 1000000 },
        dflash: { address: 0x3f43a000, size: 1000000 },
    };

    constructor(globalConfigHandler: GlobalConfigHandler, projectConfigHandler: ProjectConfigHandler) {
        this.globalConfigHandler = globalConfigHandler;
        const boardConfig = this.globalConfigHandler.getBoardConfig(this.boardName);
        if (boardConfig === undefined) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
        this.boardConfig = boardConfig;
        this.projectConfigHandler = projectConfigHandler;
    }

    getDummyMemoryLayout(): MemoryLayout {
        return this.dummyMemoryLayout;
    }

    async buildProject(memoryLayout: MemoryLayout): Promise<ExecutableBinary> {
        const project = Project.load<PackageForEsp32>(
            this.projectConfigHandler.getConfig().projectName,
            this.packageReader.bind(this),
        );
        const toolchain = new Esp32Toolchain(this.getCompilerConfig(), memoryLayout);
        this.compiler = new CompilerSession(toolchain);
        return this.compiler.buildProject(project);
    }

    async compileFragment(src: string) {
        if (!this.compiler) {
            throw new Error("Cannot compile fragment before building the project.");
        }
        return this.compiler.compileFragment(src);
    }

    private getCompilerConfig(): Esp32ToolchainConfig {
        const runtimeDir = this.projectConfigHandler?.getConfig().runtimeDir
            ?? this.globalConfigHandler.getConfig().runtimeDir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }
        return {
            runtimeDir,
            compilerToolchainDir: this.boardConfig.xtensaGccDir,
            espDir: this.boardConfig.rootDir
        }
    }

    private packageReader(name: string): PackageForEsp32 {
        const mainRoot = this.projectConfigHandler.root;
        const subPackageRoot = path.join(mainRoot, PROJECT_PATHS.PACKAGES_DIR, name);
        const isMain = name === this.projectConfigHandler.getConfig().projectName;
        const root = isMain ? mainRoot : subPackageRoot;
        try {
            const projectConfigHandler = isMain 
                ? this.projectConfigHandler.asBoard(this.boardName) 
                : ProjectConfigHandler.load(root).asBoard(this.boardName);
            return new PackageForEsp32(
                name,
                {
                    rootDir: root,
                    entry: PROJECT_PATHS.MAIN_FILE,
                    sourceDir: PROJECT_PATHS.SRC_DIR,
                    distDir: PROJECT_PATHS.DIST_DIR,
                    buildDir: PROJECT_PATHS.BUILD_DIR,
                    packageDir: PROJECT_PATHS.PACKAGES_DIR,
                },
                Object.keys(projectConfigHandler.dependencies),
                projectConfigHandler.espIdfComponents,
            )
        } catch (error) {
            throw new Error(`Failed to read ${name}.`, { cause: error });
        }
    }
}

export function getCompilerAdapter(
    boardName: BoardName,
    globalConfigHandler: GlobalConfigHandler,
    projectConfigHandler: ProjectConfigHandler
): CompilerAdapter {
    if (boardName === 'esp32') {
        return new ESP32CompilerAdapter(globalConfigHandler, projectConfigHandler);
    } else {
        throw new Error(`Unsupported board name: ${boardName}`);
    }
}
