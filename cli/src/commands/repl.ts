import { Command } from "commander";
import { Esp32BoardConfig, GLOBAL_BLUESCRIPT_PATH, GlobalConfigHandler } from "../config/global-config";
import { BoardName } from "../config/board-utils";
import { logger, LogStep, replLogger, showErrorMessages } from "../core/logger";
import { 
    BUILD_DIR,
    DEFAULT_DEVICE_NAME, 
    DIST_DIR, 
    LOCAL_PACKAGES_DIR, 
    ProjectConfigHandler, 
} from "../config/project-config";
import { BleConnection, DeviceService } from "../services/ble";
import { Compiler, ExecutableBinary, MemoryLayout, PackageConfig } from "@bluescript/lang";
import * as path from 'path';
import * as readline from 'readline';
import chalk from "chalk";
import * as fs from '../core/fs';



abstract class ReplHandler {
    static readonly TEMP_PROJECT_NAME = 'temp';
    static readonly tempProjectDir = path.join(GLOBAL_BLUESCRIPT_PATH, this.TEMP_PROJECT_NAME);
    protected globalConfigHandler: GlobalConfigHandler;
    protected ble: BleConnection|null = null;
    protected deviceService: DeviceService|null = null;
    protected rl: readline.Interface;

    constructor() {
        this.globalConfigHandler = GlobalConfigHandler.load();
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
                    const {bin} = await this.compile(memoryLayout, line);
                    await this.load(bin);
                    await this.execute(bin);
                    this.rl.prompt();
                } catch (error) {
                    reject(error);
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

    abstract createTempProject(): void;

    abstract deleteTempProject(): void;

    abstract compile(memoryLayout: MemoryLayout, src: string): Promise<{bin: ExecutableBinary, time: number}>;
}


class ESP32ReplHandler extends ReplHandler {
    readonly boardName: BoardName = 'esp32';
    private boardConfig: Esp32BoardConfig;
    private projectConfigHandler: ProjectConfigHandler;
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

    createTempProject(): void {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
        fs.makeDir(ReplHandler.tempProjectDir);
        this.projectConfigHandler.save(ReplHandler.tempProjectDir);
    }

    deleteTempProject(): void {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
    }

    async compile(memoryLayout: MemoryLayout, src: string): Promise<{ bin: ExecutableBinary; time: number; }> {
            const startCompilation = performance.now();
            if (!this.compiler) {
                this.compiler = new Compiler(memoryLayout, this.getCompilerConfig(), ESP32ReplHandler.packageReader);
            }
            const bin = await this.compiler.compile(src);
            const time = performance.now() - startCompilation;
            return {bin, time};
        }
    
    private getCompilerConfig() {
        const runtimeDir = this.globalConfigHandler.getConfig().runtimeDir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }
        const globalPackagesDir = this.globalConfigHandler.getConfig().globalPackagesDir;
        if (!globalPackagesDir) {
            throw new Error('An unexpected error occurred: cannot find directory path for global packages.');
        }
        const stdPackageDir = path.join(globalPackagesDir, 'std');
        return {
            dirs: {
                runtime: runtimeDir,
                compilerToolchain: this.boardConfig.xtensaGccDir,
                std: stdPackageDir
            }
        }
    }
    
    private static packageReader(packageName: string): PackageConfig {
        if (packageName !== 'main') {
            throw new Error('The REPL does not support importing packages.');
        }
        const root = ReplHandler.tempProjectDir;
        try {
            const projectConfigHandler = ProjectConfigHandler.load(root).asBoard('esp32');
            return {
                name: packageName,
                espIdfComponents: projectConfigHandler.espIdfComponents,
                dependencies: Object.keys(projectConfigHandler.dependencies),
                dirs: {
                    root,
                    dist: DIST_DIR(root),
                    build: BUILD_DIR(root),
                    packages: LOCAL_PACKAGES_DIR(root)
                }
            }
        } catch (error) {
            throw new Error(`Faild to read ${packageName}.`, { cause: error });
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