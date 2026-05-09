import { Command } from "commander";
import { logger, runAsyncWithLogStep, replLogger, showErrorMessages } from "../core/logger";
import { DEFAULT_DEVICE_NAME, ProjectConfigHandler } from "../config/project-config";
import { ErrorLog, MemoryLayout } from "@bscript/lang";
import * as path from 'path';
import * as readline from 'readline';
import chalk from "chalk";
import * as fs from '../core/fs';
import { CommandHandler } from "./command";
import { GLOBAL_SETTINGS } from "../config/constants";
import { CompilerAdapter, getCompilerAdapter } from "../boards/compiler-adapters";
import { BleDeviceManager } from "../services/device-manager";
import { BoardName } from "../config/board-utils";

class ReplHandler extends CommandHandler {
    static readonly TEMP_PROJECT_NAME = 'temp';
    static readonly tempProjectDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, this.TEMP_PROJECT_NAME);

    private projectConfigHandler: ProjectConfigHandler;
    private compilerAdapter: CompilerAdapter;
    private deviceManager: BleDeviceManager;
    private rl: readline.Interface;

    constructor(private boardName: string) {
        super();

        this.projectConfigHandler = ProjectConfigHandler.createTemplate(ReplHandler.TEMP_PROJECT_NAME, this.boardName as BoardName);
        this.compilerAdapter = getCompilerAdapter(this.boardName as BoardName, this.globalConfigHandler, this.projectConfigHandler);

        const deviceName = DEFAULT_DEVICE_NAME;
        this.deviceManager = new BleDeviceManager(deviceName, replLogger, () => {
            logger.error('BLE disconnected.');
            this.deleteTempProject();
            process.exit(1);
        });

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue.bold('> ')
        });
    }

    async start() {
        await runAsyncWithLogStep('Connecting via BLE...', () => this.deviceManager.connect());
        const memoryLayout = await runAsyncWithLogStep('Initializing Device...', () => this.deviceManager.initDevice());

        this.createTempProject();
        await this.runRepl(memoryLayout);
        this.deleteTempProject();

        await runAsyncWithLogStep('Disconnecting...', () => this.deviceManager.disconnect());
        process.exit(0);
    }

    private runRepl(memoryLayout: MemoryLayout) {
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        this.rl.prompt();
        return new Promise<void>((resolve, reject) => {
            this.rl.on('line', async (line) => {
                try {
                    const bin = await this.compilerAdapter.compile(memoryLayout, line);
                    await this.deviceManager.load(bin);
                    await this.deviceManager.execute(bin);
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

    private createTempProject() {
        if (fs.exists(ReplHandler.tempProjectDir)) {
            fs.removeDir(ReplHandler.tempProjectDir)
        }
        fs.makeDir(ReplHandler.tempProjectDir);
        this.projectConfigHandler.save(ReplHandler.tempProjectDir);
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