import { Command } from "commander";
import chalk from 'chalk';
import { GlobalConfigHandler } from "../../config/global-config";
import { BOARD_NAMES } from "../../config/board-utils";
import { logger, showErrorMessages } from "../../core/logger";

export async function handleListCommand() {
    try {
        const supportedBoards = BOARD_NAMES;
        const globalConfigHandler = GlobalConfigHandler.load();

        logger.log('Available boards:');
        supportedBoards.forEach(board => {
            const isSetup = globalConfigHandler.isBoardSetup(board);
            logger.log(' --', board, isSetup ? ` - ${chalk.green('set up')}` : ` - ${chalk.gray('not set up')}`);
        });

        logger.br();
        logger.info(`To set up a new board, run ${chalk.yellow('bluescript board setup <board-name>')}`);

    } catch (error) {
        logger.error(`Failed to list up available board names`);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerListCommand(program: Command) {
    program
        .command('list')
        .description('list up available board names')
        .action(handleListCommand);
}