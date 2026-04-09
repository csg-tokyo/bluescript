import { Command } from "commander";
import { logger, runAsyncWithLogStep, ProgramLogger, showErrorMessages } from "../../core/logger";
import { DEFAULT_DEVICE_NAME, ProjectConfigHandler } from "../../config/project-config";
import { cwd } from "../../core/shell";
import * as readline from 'readline';
import { CommandHandler } from "../command";
import { CompilerAdapter, getCompilerAdapter } from "../../boards/compiler-adapters";
import { BleDeviceManager } from "../../services/device-manager";
import { ExecutableBinary } from "@bscript/lang";

class RunHandler extends CommandHandler {
    private compilerAdapter: CompilerAdapter;
    private deviceManager: BleDeviceManager;
    private programLogger: ProgramLogger;

    constructor(private projectConfigHandler: ProjectConfigHandler) {
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

    async run() {
        await runAsyncWithLogStep('Connecting via BLE...', () => this.deviceManager.connect());
        const memoryLayout = await runAsyncWithLogStep('Initializing Device...', () => this.deviceManager.initDevice());
        const bin = await runAsyncWithLogStep('Compiling...', () => this.compilerAdapter.compile(memoryLayout));
        await runAsyncWithLogStep('Loading...', () => this.deviceManager.load(bin));

        await this.executeBinary(bin);

        await runAsyncWithLogStep('Disconnecting...', () => this.deviceManager.disconnect());
        process.exit(0);
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

    private async executeBinary(bin: ExecutableBinary) {
        this.setupStdin();
        logger.info("Start executing program. Type 'Ctrl-D' to exit.");
        this.programLogger.start();

        await new Promise<void>(async (resolve, reject) => {
            let done = false;
            process.stdin.on('keypress', (str, key) => {
                if (key.ctrl && key.name === 'd') {
                    if (!done) {
                        done = true;
                        resolve();
                    }
                }
            });
            try {
                await this.deviceManager.execute(bin);
                if (!done) {
                    done = true;
                    resolve();
                }
            } catch (e) {
                reject(e);
            }
        });

        this.programLogger.end();
    }
}

export async function handleRunCommand() {
    try {
        const projectConfigHandler = ProjectConfigHandler.load(cwd());
        const handler = new RunHandler(projectConfigHandler);
        await handler.run();
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
        .action(handleRunCommand);
}