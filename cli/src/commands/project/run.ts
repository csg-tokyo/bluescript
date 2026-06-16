import { Command, Option } from "commander";
import chalk from "chalk";
import * as readline from 'readline';
import http from 'http';
import sirv from 'sirv';
import path from 'path';
import { logger, runPipeline, step, ProgramOutput, createBoxedOutput, createConsoleOutput, createWebSocketOutput } from "../../core/logging";
import { DEFAULT_DEVICE_NAME, ProjectConfigHandler } from "../../config/project-config";
import { cwd, exec } from "../../core/shell";
import { CommandHandler } from "../command";
import { BoardRuntime, CompilerAdapter, CompileContext, createPlatformSession, getPipelineLabels } from "../../platforms";
import { CompileError, CompileOutput } from "@bscript/lang";
import { WebSocketConnection } from "../../services/websocket";

class RunHandler extends CommandHandler {
    protected compiler: CompilerAdapter;
    protected runtime: BoardRuntime;
    protected programOutput: ProgramOutput;
    protected pipelineLabels: ReturnType<typeof getPipelineLabels>;

    private globalKeypressHandler?: (str: string, key: any) => void;
    private ctrlDKeypressHandler?: (str: string, key: any) => void;

    constructor(protected projectConfigHandler: ProjectConfigHandler) {
        super();

        const boardName = this.projectConfigHandler.getBoardName();
        this.pipelineLabels = getPipelineLabels(boardName);
        const deviceName = this.projectConfigHandler.getConfig().deviceName ?? DEFAULT_DEVICE_NAME;
        this.programOutput = createBoxedOutput();

        const platform = createPlatformSession(
            boardName,
            this.globalConfigHandler,
            this.projectConfigHandler,
            deviceName,
            this.programOutput,
            () => {
                this.programOutput.onRunEnd?.();
                logger.error(this.pipelineLabels.disconnectError);
                process.exit(1);
            },
        );
        this.compiler = platform.compiler;
        this.runtime = platform.runtime;
    }

    async run(): Promise<boolean> {
        const ctx: {
            compileContext?: CompileContext;
            output?: CompileOutput;
        } = {};

        await runPipeline(ctx,
            step(this.pipelineLabels.connect, async () => {
                await this.runtime.connect();
            }),
            step(this.pipelineLabels.prepare, async (ctx) => {
                ctx.compileContext = await this.runtime.prepare();
            }),
            step('Compiling...', async (ctx) => {
                ctx.output = await this.compiler.buildProject(ctx.compileContext!);
            }),
            step('Loading...', async (ctx) => {
                await this.runtime.load(ctx.output!);
            }),
        );

        return this.executeProgram(ctx.output!);
    }

    async close() {
        await runPipeline({},
            step('Disconnecting...', async () => {
                await this.runtime.disconnect();
            }),
        );
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

    private async executeProgram(output: CompileOutput) {
        this.setupStdin();
        logger.info("Start executing program. Type 'Ctrl-D' to exit.");
        this.programOutput.onRunStart?.();
        try {
            const interrupted = await new Promise<boolean>((resolve, reject) => {
                this.ctrlDKeypressHandler = (str, key) => {
                    if (key && key.ctrl && key.name === 'd') {
                        resolve(true);
                        if (str) process.stdout.write(str);
                    }
                };
                process.stdin.on('keypress', this.ctrlDKeypressHandler);

                this.runtime.execute(output)
                    .then(() => resolve(false))
                    .catch(reject);
            });
            return interrupted;
        } finally {
            this.programOutput.onRunEnd?.();
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

        this.runtime.setOutput(createConsoleOutput());
        await this.runRepl();
        return false;
    }

    private runRepl() {
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        this.rl.prompt();
        return new Promise<void>((resolve, reject) => {
            this.rl.on('line', async (line) => {
                try {
                    const output = await this.compiler.compileFragment(line);
                    await this.runtime.load(output);
                    await this.runtime.execute(output);
                    this.rl.prompt();
                } catch (error) {
                    if (error instanceof CompileError) {
                        logger.error("** compile error: " + error.toString());
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
        await this.startUiServer();
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
        const notebookPackageJsonPath = require.resolve('@bscript/notebook/package.json');
        const clientPath = path.join(path.dirname(notebookPackageJsonPath), 'build');

        const serveStaticFiles = sirv(clientPath, {
            dev: true,
            single: true,
        });

        this.server = http.createServer(serveStaticFiles);
        const PORT = process.env.PORT || 3000;
        return new Promise<void>((resolve) => {
            this.server?.listen(PORT, () => {
                logger.info(`Notebook server is running at: http://localhost:${PORT}`);
                this.openBrowser(PORT);
                resolve();
            });
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
        const port = 8080;
        this.ws = new WebSocketConnection(port);
        const service = this.ws.getService('repl');
        this.ws.open();
        this.runtime.setOutput(createWebSocketOutput(service));
        service.on('execute', async (code: string) => {
            try {
                let {output, time} = await this.compile(code);
                service.finishCompilation(time);
                time = await this.load(output);
                service.finishLoading(time);
                time = await this.execute(output);
                service.finishExecution(time);
            } catch (error) {
                if (error instanceof CompileError) {
                    service.finishCompilation(-1, error.toString());
                } else {
                    logger.showError(error);
                    throw error;
                }
            }
        });
        logger.info(`WebSocket server is running at ws://localhost:${port}`);
    }

    private async compile(code: string) {
        const start = performance.now();
        const output = await this.compiler.compileFragment(code);
        return {output, time: performance.now() - start};
    }

    private async load(output: CompileOutput) {
        const start = performance.now();
        await this.runtime.load(output);
        return performance.now() - start;
    }

    private async execute(output: CompileOutput) {
        return await this.runtime.execute(output);
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
        logger.showError(error);
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
