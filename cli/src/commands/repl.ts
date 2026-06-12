import { Command } from "commander";
import { logger, runPipeline, step } from "../core/logging";
import { createConsoleOutput } from "../core/logging/program-output";
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

class ReplHandler extends CommandHandler {
    static readonly TEMP_PROJECT_NAME = 'temp';
    static readonly tempProjectDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, this.TEMP_PROJECT_NAME);

    private projectConfigHandler: ProjectConfigHandler;
    private platform: ReturnType<typeof createPlatformSession>;
    private rl: readline.Interface;
    private compileContext?: CompileContext;
    private isFirstCompile: boolean;

    constructor(private boardName: string) {
        super();

        this.projectConfigHandler =
            ProjectConfigHandler.createTemplate(ReplHandler.TEMP_PROJECT_NAME, this.boardName as BoardName, ReplHandler.tempProjectDir);

        this.platform = createPlatformSession(
            this.boardName as BoardName,
            this.globalConfigHandler,
            this.projectConfigHandler,
            DEFAULT_DEVICE_NAME,
            createConsoleOutput(),
            () => {
                logger.error('BLE disconnected.');
                this.deleteTempProject();
                process.exit(1);
            },
        );

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue.bold('> ')
        });
        this.isFirstCompile = true;
    }

    async start() {
        const ctx: { compileContext?: CompileContext } = {};

        await runPipeline(ctx,
            step('Connecting via BLE...', async () => {
                await this.platform.runtime.connect();
            }),
            step('Initializing Device...', async (ctx) => {
                ctx.compileContext = await this.platform.runtime.prepare();
            }),
        );
        this.compileContext = ctx.compileContext;

        this.createTempProject();
        await this.runRepl();
        this.deleteTempProject();

        await runPipeline({},
            step('Disconnecting...', async () => {
                await this.platform.runtime.disconnect();
            }),
        );
        process.exit(0);
    }

    private runRepl() {
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        this.rl.prompt();
        return new Promise<void>((resolve, reject) => {
            this.rl.on('line', async (line) => {
                try {
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

    private createTempProject() {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
        fs.makeDir(ReplHandler.tempProjectDir);
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

export async function handleReplCommand(options: { board: string }) {
    try {
        const handler = new ReplHandler(options.board);
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
        .action(handleReplCommand);
}
