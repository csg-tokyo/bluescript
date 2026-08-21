import { Command } from "commander";
import inquirer from 'inquirer';
import * as path from 'path';
import * as os from 'os';
import { SerialPort } from 'serialport'
import { BoardName } from "../../config/board-utils";
import { logger, runStep } from "../../core/logger";
import { execShell } from '../../core/command-exec';
import chalk from "chalk";
import { CommandHandlerWithUpdateCheck } from "../command";
import { DEFAULT_DEVICE_NAME } from "../../config/project-config";


const RUNTIME_ESP_PORT_DIR = (runtimeDir: string) => path.join(runtimeDir, 'ports/esp32');

abstract class FlashRuntimeHandler extends CommandHandlerWithUpdateCheck {
    abstract isSetup(): boolean;
    abstract eraseFlash(port: string): Promise<void>;
    abstract flashRuntime(port: string, deviceName?: string): Promise<void>;

    async flash(port: string, deviceName?: string) {
        await runStep('Erasing flash...', () => this.eraseFlash(port));
        await runStep('Flashing BlueScript runtime...', () => this.flashRuntime(port, deviceName));
    }
}

class ESP32FlashRuntimeHandler extends FlashRuntimeHandler {
    readonly boardName: BoardName = 'esp32';

    isSetup(): boolean {
        return this.globalConfigHandler.isBoardSetup(this.boardName);
    }

    async eraseFlash(port: string) {
        await this.runIdfPy(['erase-flash', '-p', port]);
    }
    
    async flashRuntime(port: string, deviceName?: string) {
        deviceName = deviceName ?? DEFAULT_DEVICE_NAME;
        await this.runIdfPy(
            ['-D', `DEVICE_NAME=${deviceName}`, 'build', 'flash', '-p', port],
        );
    }

    private async runIdfPy(args: string[]) {
        const osType = os.platform();
        const exportFile = this.getExportFile();
        const cwd = this.getEspPortDir();
        const preCommand = osType === 'win32' ? `call ${exportFile}` : `source ${exportFile}`;
        await execShell(`${preCommand} && idf.py ${args.join(' ')}`, { cwd });
    }

    private getEspPortDir() {
        const runtimeDir = this.globalConfigHandler.getConfig().runtimeDir;
        if (!runtimeDir) {
            throw new Error('An unexpected error occurred: cannot find runtime directory path.');
        }
        return RUNTIME_ESP_PORT_DIR(runtimeDir);
    }

    private getExportFile() {
        const boardConfig = this.globalConfigHandler.getBoardConfig('esp32');
        if (!boardConfig) {
            throw new Error('An unexpected error occurred: cannot find board config.');
        }
        return boardConfig.exportFile;
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

export function formatPortChoiceLabel(port: {
    path: string;
    manufacturer?: string;
    vendorId?: string;
    productId?: string;
}): string {
    const manufacturer = port.manufacturer || 'N/A';
    let label = `${port.path} — ${manufacturer}`;

    if (port.vendorId && port.productId) {
        label += ` (${port.vendorId.toLowerCase()}:${port.productId.toLowerCase()})`;
    }
    return label;
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
                name: formatPortChoiceLabel(port),
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