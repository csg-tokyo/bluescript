import { Command } from "commander";
import { Esp32BoardConfig } from "../config/global-config";
import { BoardName } from "../config/board-utils";
import { logger, LogStep, replLogger, showErrorMessages } from "../core/logger";
import { 
    DEFAULT_DEVICE_NAME, 
    ProjectConfigHandler, 
} from "../config/project-config";
import { BleConnection, DeviceService } from "../services/ble";
import { Compiler, CompilerConfig, ErrorLog, ExecutableBinary, MemoryLayout } from "@bscript/lang";
import * as path from 'path';
import * as readline from 'readline';
import chalk from "chalk";
import * as fs from '../core/fs';
import { CommandHandler } from "./command";
import { GLOBAL_SETTINGS } from "../config/constants";
import { esp32PackageReader } from "./utils/package-reader";


abstract class ReplHandler extends CommandHandler {
    static readonly TEMP_PROJECT_NAME = 'temp';
    static readonly tempProjectDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, this.TEMP_PROJECT_NAME);
    protected projectConfigHandler: ProjectConfigHandler;
    protected ble: BleConnection|null = null;
    protected deviceService: DeviceService|null = null;
    protected rl: readline.Interface;

    constructor() {
        super();
        this.projectConfigHandler = ProjectConfigHandler.createTemplate(ReplHandler.TEMP_PROJECT_NAME, this.getBoardName());
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue.bold('> ')
        });
    }

    async start() {
        await this.setupBle();
        const memoryLayout = await this.initDevice();
        this.createTempProject();
        await this.runRepl(memoryLayout);
        this.deleteTempProject();
        await this.disconnectBLE();
        process.exit(0);
    }

    @LogStep('Connecting via BLE...')
    protected async setupBle() {
        const deviceName = DEFAULT_DEVICE_NAME;
        this.ble = new BleConnection(deviceName);
        await this.ble.connect();
        this.ble.on('disconnected', () => {
            if (this.ble?.status !== 'disconnecting') {
                logger.error('BLE disconnected.');
                this.deleteTempProject();
                process.exit(1);
            }
            this.ble = null;
            this.deviceService = null;
        });
        this.deviceService = this.ble.getService('device');
        this.deviceService.on('log', (message) => {
            replLogger.log(message);
        });
        this.deviceService.on('error', (message) => {
            replLogger.error(message);
        });
    }

    @LogStep('Disconnecting...')
    protected async disconnectBLE() {
        if (this.ble) {
            await this.ble.disconnect();
        }
    }

    @LogStep('Initializing Device...')
    protected async initDevice(): Promise<MemoryLayout> {
        if (this.ble && this.deviceService) {
            return this.deviceService.init();
        }
        throw new Error('Failed to initialize device. BLE is not connected.');
    }

    protected runRepl(memoryLayout: MemoryLayout) {
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        this.rl.prompt();
        return new Promise<void>((resolve, reject) => {
            this.rl.on('line', async (line) => {
                try {
                    const bin = await this.compile(memoryLayout, line);
                    await this.load(bin);
                    await this.execute(bin);
                    this.rl.prompt();
                } catch (error) {
                    if (error instanceof ErrorLog) {
                        replLogger.error("** compile error: " + error.toString());
                        this.rl.prompt();
                    } else {
                        reject(error);
                    }
                }
            });
            this.rl.on('close', () => {
                resolve();
            });
        });
    }

    protected async load(bin: ExecutableBinary): Promise<number> {
        if (this.ble && this.deviceService) {
            return this.deviceService.load(bin);
        }
        throw new Error('Failed to load binary. BLE is not connected.');
    }

    protected async execute(bin: ExecutableBinary): Promise<number> {
        if (this.ble && this.deviceService) {
            return this.deviceService.execute(bin);
        }
        throw new Error('Failed to execute binary. BLE is not connected.');
    }

    protected createTempProject() {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
        fs.makeDir(ReplHandler.tempProjectDir);
        this.projectConfigHandler.save(ReplHandler.tempProjectDir);
    };

    protected deleteTempProject() {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
    };

    abstract getBoardName(): BoardName;

    abstract compile(memoryLayout: MemoryLayout, src: string): Promise<ExecutableBinary>;
}


class ESP32ReplHandler extends ReplHandler {
    readonly boardName: BoardName = 'esp32';
    private boardConfig: Esp32BoardConfig;
    private compiler?: Compiler;

    constructor() {
        super();
        const boardConfig = this.globalConfigHandler.getBoardConfig(this.boardName);
        if (boardConfig === undefined) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
        this.boardConfig = boardConfig;
        this.projectConfigHandler = ProjectConfigHandler.createTemplate(ReplHandler.TEMP_PROJECT_NAME, this.boardName);
    }

    getBoardName(): BoardName {
        return this.boardName;
    }

    async compile(memoryLayout: MemoryLayout, src: string): Promise<ExecutableBinary> {
        if (!this.compiler) {
            this.compiler = new Compiler(memoryLayout, this.getCompilerConfig(), esp32PackageReader);
        }
        return this.compiler.compile(src);
    }
    
    private getCompilerConfig(): CompilerConfig {
        const runtimeDir = this.globalConfigHandler.getConfig().runtimeDir;
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


function getReplHandler(boardName: string) {
    if (boardName === 'esp32') {
        return new ESP32ReplHandler();
    } else {
        throw new Error(`Unsupported board name: ${boardName}`);
    }
}

export async function handleReplCommand(options: { board: string }) {
    try {
        const replHandler = getReplHandler(options.board);
        await replHandler.start();
    } catch (error) {
        logger.error(`Error while running REPL.`);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerReplCommand(program: Command) {
    program
        .command('repl')
        .description('start REPL')
        .requiredOption('-b, --board <board>', 'board name')
        .action(handleReplCommand);
}