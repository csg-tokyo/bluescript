import { Command } from "commander";
import * as os from 'os';
import inquirer from 'inquirer';
import { logger } from "../../../core/logger";
import chalk from "chalk";
import { SetupHandler } from "./base";
import { Esp32DarwinSetupHandler, Esp32WindowsSetupHandler, Esp32LinuxSetupHandler } from "./esp32";
import { HostUnixSetupHandler, HostWindowsSetupHandler } from "./host";


function getSetupHandler(board: string): SetupHandler {
    const osType = os.platform();
    if (board === 'esp32') {
        if (osType === 'darwin')
            return new Esp32DarwinSetupHandler();
        if (osType === 'linux') 
            return new Esp32LinuxSetupHandler();
        if (osType === 'win32')
            return new Esp32WindowsSetupHandler();
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    if (board === 'host') {
        if (osType === 'darwin' || osType === 'linux')
            return new HostUnixSetupHandler();
        if (osType === 'win32')
            return new HostWindowsSetupHandler();
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    throw new Error(`Unsupported board name: ${board}`);
}

export async function handleSetupCommand(board: string) {
    try {
        const setupHandler = getSetupHandler(board);

        // Check if setup has already been completed.
        if (!setupHandler.needSetup()) {
            logger.warn(`The setup for ${board} has already been completed.`);
            return;
        }
        setupHandler.loadSetupSteps();

        // Ask user if it's ok to proceed with setup.
        const setupPlan = setupHandler.getSetupPlan();
        logger.log('The following setup process will be executed:');
        setupPlan.forEach(step => logger.log(`  - ${step}`));
        const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: 'Do you want to continue?',
                default: true,
            },
        ]);
        if (!proceed) {
            logger.warn('Setup cancelled by user.');
            return;
        }

        // Setup
        await setupHandler.setup();

        logger.br();
        logger.success(`Success to set up ${board}`);
        if (board === 'host') {
            logger.info(`Next step: run ${chalk.yellow('bscript project create <project-name> -b host')}`);
        } else {
            logger.info(`Next step: run ${chalk.yellow(`bscript board flash-runtime ${board}`)}`);
        }

    } catch (error) {
        logger.error(`Failed to set up ${board}`);
        logger.showError(error);
        process.exit(1);
    }
}


export function registerSetupCommand(program: Command) {
    program
        .command('setup')
        .description('set up the environment for the specified board')
        .argument('<board-name>', 'name of the board to setup (e.g., esp32)')
        .action(handleSetupCommand);
}


