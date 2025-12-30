import { Command } from "commander";
import chalk from 'chalk';
import { BOARD_NAMES } from "../../config/board-utils";
import { logger, showErrorMessages } from "../../core/logger";
import { CommandHandler } from "../command";


class ListHandler extends CommandHandler {
    list() {
        const supportedBoards = BOARD_NAMES;
        logger.log('Available boards:');
        supportedBoards.forEach(board => {
            const isSetup = this.globalConfigHandler.isBoardSetup(board);
            logger.log(' --', board, isSetup ? ` - ${chalk.green('set up')}` : ` - ${chalk.gray('not set up')}`);
        });
    }
}

export async function handleListCommand() {
    try {
        const listHandler = new ListHandler();
        listHandler.list();

        logger.br();
        logger.info(`To set up a new board, run ${chalk.yellow('bscript board setup <board-name>')}`);

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