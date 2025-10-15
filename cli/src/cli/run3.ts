import { Compiler, ExecutableBinary, MemoryLayout, CompilerConfig, PackageConfig, ErrorLog } from "@bluescript/compiler";
import { BsConfig, readBsConfig } from "./utils";
import { ESP_IDF_PATH, GLOBAL_PATH, PACKAGE_PATH } from "./path";
import { BleConnection, DeviceService } from "../services/ble";
import { ReplService, WebSocketConnection } from "../services/websocket";
import { logger } from "./utils";

const WEBSOCKET_PORT = 8080;

export default async function run() {
    const bsConfig = readBsConfig(PACKAGE_PATH.BSCONFIG_FILE('./'));
    try {
        const runner = createRunner(bsConfig);
        await runner.run();
        await runner.startReplServer();
    } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

abstract class Runner {
    protected readonly bsConfig: BsConfig;
    private ble: BleConnection|null = null;
    private deviceService: DeviceService|null = null;
    private webSocket: WebSocketConnection|null = null;
    private replService: ReplService|null = null;

    constructor(bsConfig: BsConfig) {
        this.bsConfig = bsConfig;
    }

    public async run() {
        try {
            await this.setupBle();
            const memoryLayout = await this.initDevice();
            const {bin, compilationTime} = await this.compile(memoryLayout);
            console.log('Finish compilation', compilationTime);
            const loadingTime = await this.load(bin);
            console.log('Finish loading');
            const executionTime = await this.execute(bin);
            console.log('Finish execution', loadingTime, executionTime);
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    protected async setupBle() {
        this.ble = new BleConnection(this.bsConfig.device.name);
        await this.ble.connect();
        this.ble.on('disconnected', () => {
            if (this.ble?.status !== 'disconnecting') {
                logger.error("BLE disconnected");
            }
            this.ble = null;
            this.deviceService = null;
        });
        this.deviceService = this.ble.getService('device');
        this.deviceService.on('log', (message) => {
            logger.bsLog(message);
        });
        this.deviceService.on('error', (message) => {
            logger.bsError(message);
        });
    }

    protected async initDevice(): Promise<MemoryLayout> {
        if (this.ble && this.deviceService) {
            return this.deviceService.init();
        }
        throw new Error('Failed to initialize device. BLE is not connected.');
    }

    public async startReplServer() {
        this.setupWebSocket();
        this.updateDeviceServiceForRepl();
        console.log(`connect to ws://localhost:${WEBSOCKET_PORT}`);
    }

    protected updateDeviceServiceForRepl() {
        this.deviceService?.on('log', (message) => {
            this.replService?.log(message);
        });
        this.deviceService?.on('error', (message) => {
            this.replService?.error(message);
        });
    }

    protected async setupWebSocket() {
        this.webSocket = new WebSocketConnection(WEBSOCKET_PORT);
        this.webSocket.on('connected', () => {
            console.log("Connected");
            this.replService = this.webSocket!.getService('repl');
            this.replService.on('execute', async (code) => {
                let bin: ExecutableBinary, compilationTime: number;
                try {
                    ({bin, compilationTime} = await this.additionalCompile(code))
                } catch (error) {
                    const errorMessage = error instanceof ErrorLog ? error.messages.join('\n')
                                        : error instanceof Error ? error.message
                                        : String(error);
                    console.log(errorMessage);
                    this.replService?.finishCompilation(-1, errorMessage);
                    return;
                }
                this.replService?.finishCompilation(compilationTime);
                const loadingTime = await this.deviceService?.load(bin) ?? -1;
                this.replService?.finishLoading(loadingTime);
                const executionTime = await this.deviceService?.execute(bin) ?? -1;
                this.replService?.finishExecution(executionTime);
                console.log("Finish execution")
            })
        });
        this.webSocket.on('disconnected', () => {
            console.log('disconnected');
            this.replService?.off('execute');
        });
        this.webSocket.open();
    }

    protected async compile(memoryLayout: MemoryLayout): Promise<{bin: ExecutableBinary, compilationTime: number}> {
        const startCompilation = performance.now();
        const bin = await this.doCompile(memoryLayout);
        return {bin, compilationTime: performance.now() - startCompilation};
    }

    protected abstract doCompile(memoryLayout: MemoryLayout): Promise<ExecutableBinary>;

    protected async additionalCompile(code: string): Promise<{bin: ExecutableBinary, compilationTime: number}> {
        const startCompilation = performance.now();
        const bin = await this.doAdditionalCompile(code);
        return {bin, compilationTime: performance.now() - startCompilation};
    }

    protected abstract doAdditionalCompile(code: string): Promise<ExecutableBinary>;

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
}

class RunnerForESP32 extends Runner {
    private compiler: Compiler|null = null;
    private compilerConfig: CompilerConfig;

    constructor(bsConfig: BsConfig) {
        super(bsConfig);
        this.compilerConfig = this.getCompilerConfig(bsConfig);
    }

    protected doCompile(memoryLayout: MemoryLayout): Promise<ExecutableBinary> {
        this.compiler = new Compiler(memoryLayout, this.compilerConfig, RunnerForESP32.packageReader);
        return this.compiler.compile();
    }

    protected doAdditionalCompile(code: string): Promise<ExecutableBinary> {
        if (this.compiler) {
            return this.compiler.additionalCompile(code);
        }
        throw new Error('The first compilation have not yet performed.');
    }
    
    private getCompilerConfig(bsConfig: BsConfig): CompilerConfig {
        return {
            dirs: {
                runtime: bsConfig.dirs?.runtime ?? GLOBAL_PATH.RUNTIME_DIR(),
                compilerToolchain: ESP_IDF_PATH.XTENSA_GCC_DIR(),
                std: PACKAGE_PATH.SUB_PACKAGE_DIR(bsConfig.dirs?.packages ?? GLOBAL_PATH.PACKAGES_DIR(), 'std'),
            }
        }
    }

    private static packageReader(packageName: string): PackageConfig {
        const cwd = process.cwd();
        const packageRoot = packageName === 'main' ? cwd : PACKAGE_PATH.SUB_PACKAGE_DIR(PACKAGE_PATH.LOCAL_PACKAGES_DIR(cwd), packageName);
        try {
            const bsConfig = readBsConfig(PACKAGE_PATH.BSCONFIG_FILE(packageRoot));
            return {
                name: packageName,
                espIdfComponents: bsConfig.espIdfComponents ?? [],
                dependencies: bsConfig.dependencies ?? [],
                dirs: {
                    root: packageRoot,
                    dist: PACKAGE_PATH.DIST_DIR(packageRoot),
                    build: PACKAGE_PATH.BUILD_DIR(packageRoot),
                    packages: PACKAGE_PATH.LOCAL_PACKAGES_DIR(packageRoot)
                }
            }
        } catch (error) {
            throw new Error(`Faild to read ${packageName}: ${error?.toString()}`);
        }
    }
}

const runnerMap: Record<string, new (bsConfig: BsConfig) => Runner> = {
    'esp32': RunnerForESP32,
    // 'host': RunnerForHost,
};

function createRunner(bsConfig: BsConfig): Runner {
    const RunnerClass = runnerMap[bsConfig.device.kind];
    if (!RunnerClass) {
        throw new Error(`Unsupported device kind: ${bsConfig.device.kind}`);
    }
    return new RunnerClass(bsConfig);
}
