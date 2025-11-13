import { Command } from "commander";
import inquirer from 'inquirer';
import * as path from 'path';
import { SerialPort } from 'serialport'
import { BoardName, GlobalConfigHandler } from "../../core/config";
import { logger, LogStep, showErrorMessages } from "../../core/logger";
import { exec } from '../../core/shell';


const RUNTIME_ESP_PORT_DIR = (runtimeDir: string) => path.join(runtimeDir, 'ports/esp32');

abstract class FlashRuntimeHandler {
    globalConfigHandler: GlobalConfigHandler;
    
    constructor() {
        this.globalConfigHandler = new GlobalConfigHandler();
    }

    abstract isSetup(): boolean;

    abstract flashRuntime(port: string, monitor: boolean): Promise<void>;
}

class ESP32FlashRuntimeHandler extends FlashRuntimeHandler {
    readonly boardName: BoardName = 'esp32';

    isSetup(): boolean {
        return this.globalConfigHandler.isBoardSetup(this.boardName);
    }
    
    @LogStep('Flashing...')
    async flashRuntime(port: string, monitor: boolean) {
        const runtimeDir = this.globalConfigHandler.globalConfig.runtime?.dir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }

        const boardConfig = this.globalConfigHandler.getBoardConfig(this.boardName);
        if (!boardConfig) {
            throw new Error('An unexpected error occurred: cannot find board config.');
        }

        await exec(
            `source ${boardConfig.exportFile} && idf.py build flash${monitor ? ' monitor' : ''} -p ${port}`,
            { cwd: RUNTIME_ESP_PORT_DIR(runtimeDir) }
        )
    }
}

function getFlashRuntimeHandler(board: string) {
    if (board === 'esp32') {
        return new ESP32FlashRuntimeHandler();
    } else {
        throw new Error('Unknown board.');
    }
}

export async function handleFlashRuntimeCommand(board: string, options: { port?: string, monitor?: boolean }) {
    try {
        const flashRuntimeHandler = getFlashRuntimeHandler(board);

        // Check if setup has already been completed.
        if (!flashRuntimeHandler.isSetup()) {
            logger.warn(`The environment for ${board} is not set up. Run 'bluescript board setup ${board}' and try again.`);
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
        await flashRuntimeHandler.flashRuntime(selectedPort, !!options.monitor);

        logger.success(`Success to flash BlueScript runtime to ${board}`);
        logger.info(`Next step: go to the project directory and run 'bluescript run'`);

    } catch (error) {
        logger.error(`Failed to flash runtime to ${board}`);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerFlashRuntimeCommand(program: Command) {
    program
        .command('flash-runtime')
        .description('flash the BlueScript runtime to the board.')
        .argument('<board-name>', 'the name of the board to flash (e.g., esp32)') 
        .option('-p, --port', 'serial port to flash to')
        .option('-m, --monitor', 'start serial monitor after flashing')
        .action(handleFlashRuntimeCommand);
}