import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../../core/logger";
import { DEFAULT_DEVICE_NAME } from "../../config/project-config";
import { getFlashRuntimeHandler } from "./flash-runtime";


export async function handleBuildRuntimeCommand(board: string, options: { deviceName?: string }) {
    try {
        const handler = getFlashRuntimeHandler(board);

        if (!handler.isSetup()) {
            logger.warn(`The environment for ${board} is not set up. Run 'bscript board setup ${board}' and try again.`);
            return;
        }

        const buildDir = await handler.build(options.deviceName);

        logger.br();
        logger.success(`Success to build the BlueScript runtime for ${board}`);
        logger.info(`Build artifacts: ${chalk.yellow(buildDir)}`);
        logger.info('To flash from another host, copy the build directory there and run:');
        logger.info(`  ${chalk.yellow(`esptool.py --chip ${board} -p <port> write_flash @flash_args`)} (in the copied directory)`);
        logger.info(`or connect the board to this host and run ${chalk.yellow(`bscript board flash-runtime ${board}`)}`);
    } catch (error) {
        logger.error(`Failed to build the runtime for ${board}`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerBuildRuntimeCommand(program: Command) {
    program
        .command('build-runtime')
        .description('build the BlueScript runtime for the board without flashing it.')
        .argument('<board-name>', 'the name of the board to build for (e.g., esp32, esp32s3)')
        .option('-d, --device-name <device-name>', `BLE device name embedded in the runtime, the default is '${DEFAULT_DEVICE_NAME}'`)
        .action(handleBuildRuntimeCommand);
}
