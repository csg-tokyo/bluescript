import { Command } from "commander";
import { Esp32BoardConfig, GlobalConfigHandler } from "../config/global-config";
import { BoardName } from "../config/board-utils";
import { logger, LogStep, ProgramLogger, showErrorMessages } from "../core/logger";
import { 
    BUILD_DIR,
    DEFAULT_DEVICE_NAME, 
    DIST_DIR, 
    LOCAL_PACKAGES_DIR, 
    ProjectConfigHandler, 
} from "../config/project-config";
import { cwd } from "../core/shell";
import { BleConnection, DeviceService } from "../services/ble";
import { Compiler, ExecutableBinary, MemoryLayout, PackageConfig } from "@bluescript/compiler";
import * as path from 'path';
import * as readline from 'readline';


abstract class RunHandler {
    protected globalConfigHandler: GlobalConfigHandler;
    protected projectConfigHandler: ProjectConfigHandler;
    protected programLogger: ProgramLogger;
    protected ble: BleConnection|null = null;
    protected deviceService: DeviceService|null = null;
    
    constructor(projectConfigHandler: ProjectConfigHandler) {
        this.globalConfigHandler = GlobalConfigHandler.load();
        this.projectConfigHandler = projectConfigHandler;
        this.programLogger = new ProgramLogger();
    }

    async run() {
        await this.setupBle();
        const memoryLayout = await this.initDevice();
        const {bin} = await this.compile(memoryLayout);
        await this.load(bin);
        await this.execute(bin);
        await this.disconnectBLE();
        process.exit(0);
    }

    @LogStep('Connecting via BLE...')
    protected async setupBle() {
        const deviceName = this.projectConfigHandler.getConfig().deviceName ?? DEFAULT_DEVICE_NAME;
        this.ble = new BleConnection(deviceName);
        await this.ble.connect();
        this.ble.on('disconnected', () => {
            if (this.ble?.status !== 'disconnecting') {
                this.programLogger.end();
                logger.error('BLE disconnected.');
                process.exit(1);
            }
            this.ble = null;
            this.deviceService = null;
        });
        this.deviceService = this.ble.getService('device');
        this.deviceService.on('log', (message) => {
            this.programLogger.log(message);
        });
        this.deviceService.on('error', (message) => {
            this.programLogger.error(message);
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

    @LogStep('Loading...')
    protected async load(bin: ExecutableBinary): Promise<number> {
        if (this.ble && this.deviceService) {
            return this.deviceService.load(bin);
        }
        throw new Error('Failed to load binary. BLE is not connected.');
    }

    protected async execute(bin: ExecutableBinary): Promise<number> {
        this.setupStdin();
        return new Promise(async (resolve, reject) => {
            if (this.ble && this.deviceService) {
                logger.info("Start executing program. Type 'Ctrl-D' to exit.");
                this.programLogger.start();
                let exectime: number;
                process.stdin.on('keypress', (str, key) => {
                    if (key.ctrl && key.name === 'd') {
                        this.programLogger.end();
                        resolve(exectime);
                    }
                });
                exectime = await this.deviceService.execute(bin);
            } else {
                reject('Failed to execute binary. BLE is not connected.');
            }
        });
    }

    private setupStdin() {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.on('keypress', (str, key) => {
            if (key.ctrl && key.name === 'c') {
                process.exit(0);
            }
            process.stdout.write(str);
        });
    }

    abstract compile(memoryLayout: MemoryLayout): Promise<{bin: ExecutableBinary, time: number}>;
}

class ESP32RunHandler extends RunHandler {
    readonly boardName: BoardName = 'esp32';
    private boardConfig: Esp32BoardConfig;

    constructor(projectConfigHandler: ProjectConfigHandler) {
        super(projectConfigHandler);
        const boardConfig = this.globalConfigHandler.getBoardConfig(this.boardName);
        if (boardConfig === undefined) {
            throw new Error(`The environment for ${this.boardName} is not set up.`);
        }
        this.boardConfig = boardConfig;
    }

    @LogStep('Compiling...')
    async compile(memoryLayout: MemoryLayout): Promise<{ bin: ExecutableBinary; time: number; }> {
        const startCompilation = performance.now();
        const compiler = new Compiler(memoryLayout, this.getCompilerConfig(), ESP32RunHandler.packageReader);
        const bin = await compiler.compile();
        const time = performance.now() - startCompilation;
        return {bin, time};
    }

    private getCompilerConfig() {
        const runtimeDir = this.projectConfigHandler.getConfig().runtimeDir 
                            ?? this.globalConfigHandler.getConfig().runtimeDir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }
        const globalPackagesDir = this.projectConfigHandler.getConfig().globalPackagesDir 
                            ?? this.globalConfigHandler.getConfig().globalPackagesDir;
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
        const mainRoot = cwd();
        const subPackageRoot = path.join(LOCAL_PACKAGES_DIR(mainRoot), packageName);
        const root = packageName === 'main' ? mainRoot : subPackageRoot;
        try {
            const projectConfigHandler = ProjectConfigHandler.load(root).asBoard('esp32');
            return {
                name: packageName,
                espIdfComponents: projectConfigHandler.espIdfComponents,
                dependencies: projectConfigHandler.dependencies,
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

function getRunHandler(projectConfigHandler: ProjectConfigHandler) {
    const boardName = projectConfigHandler.getBoardName();
    if (boardName === 'esp32') {
        return new ESP32RunHandler(projectConfigHandler);
    } else {
        throw new Error(`Unsupported board name: ${boardName}`);
    }
}

export async function handleRunCommand(board: string) {
    try {
        const projectConfigHandler = ProjectConfigHandler.load(cwd());
        const runHandler = getRunHandler(projectConfigHandler);
        await runHandler.run();
    } catch (error) {
        logger.error(`Failed to run BlueScript program.`);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerRunCommand(program: Command) {
    program
        .command('run')
        .description('run BlueScript program')
        .action(handleRunCommand);
}