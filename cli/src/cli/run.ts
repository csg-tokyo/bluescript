import { Compiler, ExecutableBinary, MemoryLayout, CompilerConfig, PackageConfig, ErrorLog } from "@bluescript/compiler";
import { BsConfig, readBsConfig } from "./utils";
import { ESP_IDF_PATH, GLOBAL_PATH, PACKAGE_PATH } from "./path";
import { BleConnection, DeviceService } from "../services/ble";
import { ReplService, WebSocketConnection } from "../services/websocket";
import { logger } from "./utils";

export default async function run(withRepl?: boolean) {
    const bsConfig = readBsConfig(PACKAGE_PATH.BSCONFIG_FILE('./'));
    const runner = !withRepl ? new Runner(bsConfig) : new RunnerWithRepl(bsConfig);
    await runner.run();
}


class Runner {
    protected readonly bsConfig: BsConfig;
    protected compiler: CompilerESP32;
    protected ble: BleConnection|null = null;
    protected deviceService: DeviceService|null = null;

    constructor(bsConfig: BsConfig) {
        this.bsConfig = bsConfig;
        this.compiler = new CompilerESP32(bsConfig);
    }

    public async run() {
        try {
            logger.info(`Connecting to ${this.bsConfig.device.name} via Bluetooth`);
            await this.setupBle();
            logger.info('Init Device');
            const memoryLayout = await this.initDevice();
            logger.info('Start compiling');
            const {bin} = await this.compile(memoryLayout);
            logger.info('Start loading');
            await this.load(bin);
            logger.info('Start execution');
            await this.execute(bin);
            logger.info('Finish execution');
            await this.ble?.disconnect();
            process.exit(0);
        } catch (error) {
            logger.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
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

    protected async compile(memoryLayout: MemoryLayout): Promise<{bin: ExecutableBinary, time: number}> {
        const startCompilation = performance.now();
        const bin = await this.compiler.compile(memoryLayout);
        return {bin, time: performance.now() - startCompilation};
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
}


type ResultHandlers = {
    onFinishCompilation: (time: number) => void,
    onFailedToCompile: (error: string) => void,
    onFinishLoading: (time: number) => void,
    onFinishExecution: (time: number) => void
}

class RunnerWithRepl extends Runner {
    private readonly WEBSOCKET_PORT = 8080;
    private webSocket: WebSocketConnection|null = null;
    private replService: ReplService|null = null;

    override async run(): Promise<void> {
        await this.setupBle();
        this.startWebSocketServer();
        logger.info(`Start WebSocket server on ws://localhost:${this.WEBSOCKET_PORT}`);
    }

    protected override async setupBle() {
        await super.setupBle();
        this.ble?.on('disconnected', () => {
            this.webSocket = null;
            this.replService = null;
        });
        this.deviceService?.on('log', (message) => {
            this.replService?.log(message);
        });
        this.deviceService?.on('error', (message) => {
            this.replService?.error(message);
        });
    }

    protected startWebSocketServer() {
        this.webSocket = new WebSocketConnection(this.WEBSOCKET_PORT);
        this.webSocket.on('connected', () => {
            logger.info("WebSocket connected");
            this.replService = this.webSocket!.getService('repl');
            const resultHandlers: ResultHandlers = {
                onFinishCompilation: (time) => this.replService?.finishCompilation(time),
                onFailedToCompile: (error) => this.replService?.finishCompilation(-1, error),
                onFinishLoading: (time) => this.replService?.finishLoading(time),
                onFinishExecution: (time) => this.replService?.finishExecution(time)
            }
            this.replService.on('executeMain', async () => {
                const memoryLayout = await this.initDevice();
                await this.executeMain(memoryLayout, resultHandlers);
            });
            this.replService.on('executeCell', async (code) => {
                await this.executeCell(code, resultHandlers);
            });
        });
        this.webSocket.on('disconnected', () => {
            logger.info("WebSocket disconnected");
            this.replService?.off('executeCell');
            this.replService?.off('executeMain');
        });
        this.webSocket.open();
    }

    protected async executeMain(memoryLayout: MemoryLayout, resultHandlers: ResultHandlers): Promise<void> {
        return this.executeTarget(
            () => this.compile(memoryLayout),
            resultHandlers
        )
    }

    protected executeCell(code: string, resultHandlers: ResultHandlers): Promise<void> {
        return this.executeTarget(
            () => this.additionalCompile(code),
            resultHandlers
        )
    }

    protected async executeTarget(
        compile: () => Promise<{bin: ExecutableBinary, time: number}>, 
        resultHandlers: ResultHandlers
    ): Promise<void> {
        let bin: ExecutableBinary, compilationTime: number;
        try {
            ({bin, time: compilationTime} = await compile());
            resultHandlers.onFinishCompilation(compilationTime);
        } catch (error) {
            const errorMessage = error instanceof ErrorLog ? error.messages.join('\n')
                                : error instanceof Error ? error.message
                                : String(error);
            resultHandlers.onFailedToCompile(errorMessage);
            console.log(errorMessage)
            return;
        }
        const loadingTime = await this.load(bin);
        resultHandlers.onFinishLoading(loadingTime);
        const executionTime = await this.execute(bin);
        resultHandlers.onFinishExecution(executionTime);
    }

    protected async additionalCompile(code: string): Promise<{bin: ExecutableBinary, time: number}> {
        const startCompilation = performance.now();
        const bin = await this.compiler.additionalCompile(code);
        return {bin, time: performance.now() - startCompilation};
    }
}

class CompilerESP32 {
    private compiler: Compiler|null = null;
    private compilerConfig: CompilerConfig;

    constructor(bsConfig: BsConfig) {
        this.compilerConfig = this.getCompilerConfig(bsConfig);
    }

    public compile(memoryLayout: MemoryLayout): Promise<ExecutableBinary> {
        this.compiler = new Compiler(memoryLayout, this.compilerConfig, CompilerESP32.packageReader);
        return this.compiler.compile();
    }

    public additionalCompile(code: string): Promise<ExecutableBinary> {
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