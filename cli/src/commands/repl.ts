import { Command } from "commander";
import { logger, runStep } from "../core/logger";
import { createConsoleOutput } from "../core/logger/program-output";
import { DEFAULT_DEVICE_NAME, PROJECT_DEFAULT_PATHS, ProjectConfigHandler } from "../config/project-config";
import * as path from 'path';
import * as readline from 'readline';
import chalk from "chalk";
import * as fs from '../core/fs';
import { CommandHandler } from "./command";
import { GLOBAL_SETTINGS } from "../config/constants";
import { CompileContext, createPlatformSession } from "../platforms";
import { BoardName } from "../config/board-utils";
import { CompileError, CompileOutput } from "@bscript/lang";
import { SerialTaskQueue } from "../core/serial-task-queue";

type ReplReadlineFactory = () => readline.Interface;

function defaultReplReadlineFactory(): readline.Interface {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue.bold('> '),
    });
}

class ReplHandler extends CommandHandler {
    static readonly TEMP_PROJECT_NAME = 'temp';
    static readonly tempProjectDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, this.TEMP_PROJECT_NAME);

    private projectConfigHandler: ProjectConfigHandler;
    private platform: ReturnType<typeof createPlatformSession>;
    private rl: readline.Interface;
    private compileContext?: CompileContext;
    private isFirstCompile: boolean;
    private readonly taskQueue = new SerialTaskQueue();

    constructor(
        private boardName: string,
        private deviceName?: string,
        private createReadline: ReplReadlineFactory = defaultReplReadlineFactory,
    ) {
        super();

        const board = this.boardName as BoardName;
        this.projectConfigHandler =
            ProjectConfigHandler.createTemplate(ReplHandler.TEMP_PROJECT_NAME, board, ReplHandler.tempProjectDir);
        this.projectConfigHandler.update({ deviceName: this.deviceName ?? DEFAULT_DEVICE_NAME });

        this.platform = createPlatformSession(
            board,
            this.globalConfigHandler,
            this.projectConfigHandler,
            createConsoleOutput(),
            () => {
                logger.error('Disconnected.');
                this.deleteTempProject();
                process.exit(1);
            },
        );

        this.rl = this.createReadline();
        this.isFirstCompile = true;
    }

    async start() {
        await runStep('Connecting...', () => this.platform.runtime.connect());
        this.compileContext = await runStep('Initializing...', () => this.platform.runtime.prepare())!;

        this.createTempProject();
        await this.runRepl();
        this.deleteTempProject();
        this.rl.close();

        await runStep('Disconnecting...', () => this.platform.runtime.disconnect());
        process.exit(0);
    }

    private runRepl() {
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        this.rl.prompt();
        return new Promise<void>((resolve, reject) => {
            this.rl.on('line', (line) => {
                this.rl.pause();
                this.taskQueue.enqueue(async () => {
                    try {
                        await this.processReplLine(line);
                    } catch (error) {
                        if (error instanceof CompileError) {
                            logger.error("** compile error: " + error.toString());
                        } else {
                            reject(error);
                            return;
                        }
                    } finally {
                        this.rl.resume();
                        this.rl.prompt();
                    }
                });
            });
            this.rl.on('close', () => {
                resolve();
            });
        });
    }

    private async processReplLine(line: string) {
        let output: CompileOutput;
        if (this.isFirstCompile) {
            this.writeEntryFile(line);
            output = await this.platform.compiler.buildProject(this.compileContext);
            this.isFirstCompile = false;
        } else {
            output = await this.platform.compiler.compileFragment(line);
        }
        await this.platform.runtime.load(output);
        await this.platform.runtime.execute(output);
    }

    private createTempProject() {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
        fs.makeDir(ReplHandler.tempProjectDir);
        const runtimeDir = this.globalConfigHandler.getConfig().runtimeDir;
        if (runtimeDir) {
            this.projectConfigHandler.update({ runtimeDir });
        }
        this.projectConfigHandler.save(ReplHandler.tempProjectDir);
    }

    private writeEntryFile(src: string) {
        const srcDir = path.join(ReplHandler.tempProjectDir, PROJECT_DEFAULT_PATHS.SRC_DIR);
        fs.makeDir(srcDir);
        const entryPath = path.join(ReplHandler.tempProjectDir, PROJECT_DEFAULT_PATHS.ENTRY_FILE);
        fs.writeFile(entryPath, src);
    }

    private deleteTempProject() {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
    }
}

export async function handleReplCommand(
    options: { board: string, deviceName?: string },
    deps?: { createReadline?: ReplReadlineFactory },
) {
    try {
        const handler = new ReplHandler(options.board, options.deviceName, deps?.createReadline);
        await handler.start();
    } catch (error) {
        logger.error(`Error while running REPL.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerReplCommand(program: Command) {
    program
        .command('repl')
        .description('start REPL')
        .requiredOption('-b, --board <board>', 'board name')
        .option('-d, --device-name <device-name>', `device name to connect to, the default is '${DEFAULT_DEVICE_NAME}'`)
        .action(handleReplCommand);
}
