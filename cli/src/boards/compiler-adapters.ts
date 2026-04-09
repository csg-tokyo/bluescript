import { GlobalConfigHandler, Esp32BoardConfig } from "../config/global-config";
import { ProjectConfigHandler, PROJECT_PATHS } from "../config/project-config";
import { BoardName } from "../config/board-utils";
import { Compiler, CompilerConfig, ExecutableBinary, MemoryLayout } from "@bscript/lang";
import { cwd } from "../core/shell";
import * as path from 'path';

export interface CompilerAdapter {
    readonly boardName: BoardName;
    getDummyMemoryLayout(): MemoryLayout;
    compile(memoryLayout: MemoryLayout, src?: string): Promise<ExecutableBinary>;
}

export class ESP32CompilerAdapter implements CompilerAdapter {
    readonly boardName: BoardName = 'esp32';
    private boardConfig: Esp32BoardConfig;
    private compiler?: Compiler;

    readonly dummyMemoryLayout: MemoryLayout = {
        iram: { address: 0x40096c34, size: 1000000 },
        dram: { address: 0x3ffd5b1c, size: 1000000 },
        iflash: { address: 0x40150000, size: 1000000 },
        dflash: { address: 0x3f43a000, size: 1000000 },
    };

    constructor(
        private globalConfigHandler: GlobalConfigHandler,
        private projectConfigHandler?: ProjectConfigHandler
    ) {
        const boardConfig = this.globalConfigHandler.getBoardConfig(this.boardName);
        if (boardConfig === undefined) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
        this.boardConfig = boardConfig;
    }

    getDummyMemoryLayout(): MemoryLayout {
        return this.dummyMemoryLayout;
    }

    async compile(memoryLayout: MemoryLayout, src?: string): Promise<ExecutableBinary> {
        if (!this.compiler) {
            this.compiler = new Compiler(memoryLayout, this.getCompilerConfig(), this.packageReader.bind(this));
        }
        if (src !== undefined) {
            return this.compiler.compile(src);
        } else {
            return this.compiler.compile();
        }
    }

    private getCompilerConfig(): CompilerConfig {
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

    private packageReader(packageName: string) {
        const mainRoot = cwd();
        const subPackageRoot = path.join(PROJECT_PATHS.PACKAGES_DIR(mainRoot), packageName);
        const root = packageName === 'main' ? mainRoot : subPackageRoot;
        try {
            const projectConfigHandler = ProjectConfigHandler.load(root).asBoard(this.boardName);
            return {
                name: packageName,
                espIdfComponents: projectConfigHandler.espIdfComponents,
                dependencies: Object.keys(projectConfigHandler.dependencies),
                dirs: {
                    root,
                    dist: PROJECT_PATHS.DIST_DIR(root),
                    build: PROJECT_PATHS.BUILD_DIR(root),
                    packages: PROJECT_PATHS.PACKAGES_DIR(root)
                }
            }
        } catch (error) {
            throw new Error(`Failed to read ${packageName}.`, { cause: error });
        }
    }
}

export function getCompilerAdapter(
    boardName: BoardName,
    globalConfigHandler: GlobalConfigHandler,
    projectConfigHandler?: ProjectConfigHandler
): CompilerAdapter {
    if (boardName === 'esp32') {
        return new ESP32CompilerAdapter(globalConfigHandler, projectConfigHandler);
    } else {
        throw new Error(`Unsupported board name: ${boardName}`);
    }
}
