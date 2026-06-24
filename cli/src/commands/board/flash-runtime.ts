import { Command } from "commander";
import inquirer from 'inquirer';
import * as path from 'path';
import { SerialPort } from 'serialport'
import { BoardName } from "../../config/board-utils";
import { logger, runStep } from "../../core/logger";
import { exec } from '../../core/shell';
import chalk from "chalk";
import { CommandHandler } from "../command";
import { DEFAULT_DEVICE_NAME } from "../../config/project-config";


const RUNTIME_ESP_PORT_DIR = (runtimeDir: string) => path.join(runtimeDir, 'ports/esp32');

abstract class FlashRuntimeHandler extends CommandHandler {
    abstract isSetup(): boolean;
    abstract flashRuntime(port: string, deviceName?: string): Promise<void>;

    async flash(port: string, deviceName?: string) {
        return runStep('Flashing...', () => this.flashRuntime(port, deviceName));
    }
}

class ESP32FlashRuntimeHandler extends FlashRuntimeHandler {
    readonly boardName: BoardName = 'esp32';

    isSetup(): boolean {
        return this.globalConfigHandler.isBoardSetup(this.boardName);
    }
    
    async flashRuntime(port: string, deviceName?: string) {
        const runtimeDir = this.globalConfigHandler.getConfig().runtimeDir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }

        const boardConfig = this.globalConfigHandler.getBoardConfig('esp32');
        if (!boardConfig) {
            throw new Error('An unexpected error occurred: cannot find board config.');
        }

        deviceName = deviceName ?? DEFAULT_DEVICE_NAME;

        await exec(
            `source ${boardConfig.exportFile} && idf.py -D DEVICE_NAME=${deviceName} build flash -p ${port}`,
            { cwd: RUNTIME_ESP_PORT_DIR(runtimeDir) }
        )
    }
}

function getFlashRuntimeHandler(board: string) {
    if (board === 'host') {
        throw new Error('flash-runtime is not supported for the host board');
    }
    if (board === 'esp32') {
        return new ESP32FlashRuntimeHandler();
    }
    throw new Error(`Unsupported board name: ${board}`);
}

export async function handleFlashRuntimeCommand(board: string, options: { port?: string, deviceName?: string }) {
    try {
        const flashRuntimeHandler = getFlashRuntimeHandler(board);

        // Check if setup has already been completed.
        if (!flashRuntimeHandler.isSetup()) {
            logger.warn(`The environment for ${board} is not set up. Run 'bscript board setup ${board}' and try again.`);
            return;
        }

        // Get serial port.
        let selectedPort = options.port;
        if (!selectedPort) {
            logger.info('Scanning for available serial ports...');
            const ports = await SerialPort.list();
            if (ports.length === 0) {
                logger.error('No serial ports found. Please connect your device and make sure drivers are installed.');
                return;
            }

            const portChoices = ports.map(port => ({
                name: `${port.path} (${port.manufacturer || 'N/A'})`,
                value: port.path,
            }));

            const { port } = await inquirer.prompt<{ port: string }>([
            {
                type: 'list',
                name: 'port',
                message: 'Select the serial port to use:',
                choices: portChoices,
            },
            ]);
            selectedPort = port;
        }
        logger.info(`Using port: ${selectedPort}`);

        // Flash runtime.
        await flashRuntimeHandler.flash(selectedPort, options.deviceName);

        logger.br();
        logger.success(`Success to flash the BlueScript runtime to ${board}`);
        logger.info(`Next step: go to the project directory and run ${chalk.yellow('bscript project run')}`);

    } catch (error) {
        logger.error(`Failed to flash the runtime to ${board}`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerFlashRuntimeCommand(program: Command) {
    program
        .command('flash-runtime')
        .description('flash the BlueScript runtime to the board.')
        .argument('<board-name>', 'the name of the board to flash (e.g., esp32)') 
        .option('-p, --port <port>', 'serial port to flash to')
        .option('-d, --device-name <device-name>', `device name to flash to, the default is '${DEFAULT_DEVICE_NAME}'`)
        .action(handleFlashRuntimeCommand);
}