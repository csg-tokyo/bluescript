import { Command } from "commander";
import { Esp32BoardConfig } from "../../config/global-config";
import { BoardName } from "../../config/board-utils";
import { logger, LogStep, ProgramLogger, showErrorMessages } from "../../core/logger";
import { ProjectConfigHandler } from "../../config/project-config";
import { cwd } from "../../core/shell";
import { BleConnection, DeviceService } from "../../services/ble";
import { Compiler, CompilerConfig, MemoryLayout } from "@bscript/lang";
import { CommandHandler } from "../command";
import { esp32PackageReader } from "../utils/package-reader";


abstract class CheckHandler extends CommandHandler {
    protected projectConfigHandler: ProjectConfigHandler;
    protected programLogger: ProgramLogger;
    protected ble: BleConnection|null = null;
    protected deviceService: DeviceService|null = null;
    
    constructor(projectConfigHandler: ProjectConfigHandler) {
        super();
        this.projectConfigHandler = projectConfigHandler;
        this.programLogger = new ProgramLogger();
    }

    async check() {
        const memoryLayout = this.getMemoryLayout();
        await this.compile(memoryLayout);
        process.exit(0);
    }

    abstract getMemoryLayout(): MemoryLayout;

    abstract compile(memoryLayout: MemoryLayout): Promise<void>;
}

class ESP32CheckHandler extends CheckHandler {
    readonly boardName: BoardName = 'esp32';
    private boardConfig: Esp32BoardConfig;
    readonly dummyMemoryLayout: MemoryLayout = {
        iram:{address:0x40096c34, size:1000000},
        dram:{address:0x3ffd5b1c, size:1000000},
        iflash:{address:0x40150000, size:1000000},
        dflash:{address:0x3f43a000, size:1000000},
    }

    constructor(projectConfigHandler: ProjectConfigHandler) {
        super(projectConfigHandler);
        const boardConfig = this.globalConfigHandler.getBoardConfig(this.boardName);
        if (boardConfig === undefined) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
        this.boardConfig = boardConfig;
    }

    getMemoryLayout(): MemoryLayout {
        return this.dummyMemoryLayout;
    }

    @LogStep('Compiling...')
    async compile(memoryLayout: MemoryLayout): Promise<void> {
        const compiler = new Compiler(memoryLayout, this.getCompilerConfig(), esp32PackageReader);
        await compiler.compile();
    }

    private getCompilerConfig(): CompilerConfig {
        const runtimeDir = this.projectConfigHandler.getConfig().runtimeDir 
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
}

function getCheckHandler(projectConfigHandler: ProjectConfigHandler) {
    const boardName = projectConfigHandler.getBoardName();
    if (boardName === 'esp32') {
        return new ESP32CheckHandler(projectConfigHandler);
    } else {
        throw new Error(`Unsupported board name: ${boardName}`);
    }
}

export async function handleCheckCommand() {
    try {
        const projectConfigHandler = ProjectConfigHandler.load(cwd());
        const runHandler = getCheckHandler(projectConfigHandler);
        await runHandler.check();
    } catch (error) {
        logger.error(`Failed to check BlueScript program.`);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerCheckCommand(program: Command) {
    program
        .command('check')
        .description('check your project')
        .action(handleCheckCommand);
}