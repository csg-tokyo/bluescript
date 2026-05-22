import { Command, Option } from "commander";
import chalk from "chalk";
import * as readline from 'readline';
import http from 'http';
import { logger, runAsyncWithLogStep, ProgramLogger, showErrorMessages, replLogger } from "../../core/logger";
import { DEFAULT_DEVICE_NAME, ProjectConfigHandler } from "../../config/project-config";
import { cwd, exec } from "../../core/shell";
import { CommandHandler } from "../command";
import { CompilerAdapter, getCompilerAdapter } from "../../boards/compiler-adapters";
import { BleDeviceManager } from "../../services/device-manager";
import { CompileError, ExecutableBinary } from "@bscript/lang";
import { WebSocketConnection } from "../../services/websocket";

class RunHandler extends CommandHandler {
    protected compilerAdapter: CompilerAdapter;
    protected deviceManager: BleDeviceManager;
    protected programLogger: ProgramLogger;

    private globalKeypressHandler?: (str: string, key: any) => void;
    private ctrlDKeypressHandler?: (str: string, key: any) => void; 

    constructor(protected projectConfigHandler: ProjectConfigHandler) {
        super();

        const boardName = this.projectConfigHandler.getBoardName();
        this.compilerAdapter = getCompilerAdapter(boardName, this.globalConfigHandler, this.projectConfigHandler);

        const deviceName = this.projectConfigHandler.getConfig().deviceName ?? DEFAULT_DEVICE_NAME;
        this.programLogger = new ProgramLogger();
        this.deviceManager = new BleDeviceManager(deviceName, this.programLogger, () => {
            this.programLogger.end();
            logger.error('BLE disconnected.');
            process.exit(1);
        });
    }

    async run(): Promise<boolean> {
        await runAsyncWithLogStep('Connecting via BLE...', () => this.deviceManager.connect());
        const memoryLayout = await runAsyncWithLogStep('Initializing Device...', () => this.deviceManager.initDevice());
        const bin = await runAsyncWithLogStep('Compiling...', () => this.compilerAdapter.buildProject(memoryLayout));
        await runAsyncWithLogStep('Loading...', () => this.deviceManager.load(bin));
        return this.executeBinary(bin);
    }

    async close() {
        await runAsyncWithLogStep('Disconnecting...', () => this.deviceManager.disconnect());
        process.exit(0);
    }

    private setupStdin() {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        this.globalKeypressHandler = (str, key) => {
            if (key && key.ctrl && key.name === 'c') {
                process.exit(0);
            }
            if (str) process.stdout.write(str);
        };
        process.stdin.on('keypress', this.globalKeypressHandler);
    }

    private resetStdin() {
        if (this.globalKeypressHandler) {
            process.stdin.off('keypress', this.globalKeypressHandler);
            this.globalKeypressHandler = undefined;
        }
        if (this.ctrlDKeypressHandler) {
            process.stdin.off('keypress', this.ctrlDKeypressHandler);
            this.ctrlDKeypressHandler = undefined;
        }
    }

    private async executeBinary(bin: ExecutableBinary) {
        this.setupStdin();
        logger.info("Start executing program. Type 'Ctrl-D' to exit.");
        this.programLogger.start();
        try {
            const interrupted = await new Promise<boolean>((resolve, reject) => {
                this.ctrlDKeypressHandler = (str, key) => {
                    if (key && key.ctrl && key.name === 'd') {
                        resolve(true); 
                        if (str) process.stdout.write(str);
                    }
                };
                process.stdin.on('keypress', this.ctrlDKeypressHandler);

                this.deviceManager.execute(bin)
                    .then(() => resolve(false))
                    .catch(reject);
            });
            return interrupted;
        } finally {
            this.programLogger.end();
            this.resetStdin(); 
        }
    }
}

class RunWithReplHandler extends RunHandler {
    private rl: readline.Interface;

    constructor(projectConfigHandler: ProjectConfigHandler) {
        super(projectConfigHandler);
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue.bold('> ')
        });
    }

    async run() {
        const interrupted = await super.run();
        if (interrupted) {
            return interrupted;
        }

        this.deviceManager.updateLogger(replLogger);
        await this.runRepl();
        return false;
    }

    private runRepl() {
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        this.rl.prompt();
        return new Promise<void>((resolve, reject) => {
            this.rl.on('line', async (line) => {
                try {
                    const bin = await this.compilerAdapter.compileFragment(line);
                    await this.deviceManager.load(bin);
                    await this.deviceManager.execute(bin);
                    this.rl.prompt();
                } catch (error) {
                    if (error instanceof CompileError) {
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
}

class RunWithNotebookHandler extends RunHandler {
    private ws: WebSocketConnection | null = null;
    private server: http.Server | null = null;

    constructor(projectConfigHandler: ProjectConfigHandler) {
        super(projectConfigHandler);
    }

    async run() {
        const interrupted = await super.run();
        if (interrupted) {
            return interrupted;
        }
        this.startWebsocket();
        this.startUiServer();
        logger.info("Type 'Ctrl-D' to exit.");

        return new Promise<boolean>((resolve) => {
            process.stdin.on('keypress', (str, key) => {
                if (key && key.ctrl && key.name === 'd') {
                    resolve(true);
                }
            });
        });
    }

    async close(): Promise<void> {
        await super.close();
        this.server?.close();
        this.ws?.close();
    }

    private startUiServer() {
        this.server = http.createServer(() => {});
        const PORT = process.env.PORT || 3001;
        this.server.listen(PORT, () => {
            logger.info(`Notebook server is running at: http://localhost:${PORT}`);
            this.openBrowser(PORT);
        });
    }

    private openBrowser(port: number|string) {
        const url = `http://localhost:${port}`;
        const startCommand = 
            process.platform === 'win32' ? 'start' : 
            process.platform === 'darwin' ? 'open' : 'xdg-open';
            
        exec(`${startCommand} ${url}`, {silent: true});
    }

    private startWebsocket() {
        this.ws = new WebSocketConnection(8080);
        const service = this.ws.getService('repl');
        this.ws.open();
        this.deviceManager.updateLogger({
            log: (message: string) => { service.log(message); },
            error: (message: string) => { service.error(message); }
        });
        service.on('execute', async (code: string) => {
            try {
                let {bin, time} = await this.compile(code);
                service.finishCompilation(time);
                time = await this.load(bin);
                service.finishLoading(time);
                time = await this.execute(bin);
                service.finishExecution(time);
            } catch (error) {
                if (error instanceof CompileError) {
                    service.finishCompilation(-1, error.toString());
                } else {
                    console.log(error)
                    throw error;
                }
            }
        });
        logger.info('WebSocket server is running at ws://localhost:8080');
    }

    private async compile(code: string) {
        const start = performance.now();
        const bin = await this.compilerAdapter.compileFragment(code);
        return {bin, time: performance.now() - start};
    }

    private async load(bin: ExecutableBinary) {
        const start = performance.now();
        await this.deviceManager.load(bin);
        return performance.now() - start;
    }

    private async execute(bin: ExecutableBinary) {
        const start = performance.now();
        await this.deviceManager.execute(bin);
        return performance.now() - start;
    }
}

export async function handleRunCommand(options: {withRepl: boolean, withNotebook: boolean}) {
    try {
        const projectConfigHandler = ProjectConfigHandler.load(cwd());
        let handler: RunHandler;
        if (options.withRepl) {
            handler = new RunWithReplHandler(projectConfigHandler);
        } else if (options.withNotebook) {
            handler = new RunWithNotebookHandler(projectConfigHandler);
        } else {
            handler = new RunHandler(projectConfigHandler);
        }

        await handler.run();
        await handler.close();
    } catch (error) {
        logger.error(`Failed to run BlueScript program.`);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerRunCommand(program: Command) {
    program
        .command('run')
        .description('run your project')
        .addOption(
            new Option('--with-repl', 'start REPL after main execution finished')
            .conflicts('withNotebook')
        )
        .addOption(
            new Option('--with-notebook', 'start notebook after main execution finished')
            .conflicts('withRepl')
        )
        .action(handleRunCommand);
}