import { Command } from "commander";
import inquirer from 'inquirer';
import { logger } from "../../core/logger";
import { CommandHandler } from "../command";
import { BaseBoardEnv } from "../../platforms/board-env";


class FullcleanHandler extends CommandHandler {
    constructor() {
        super(false);
    }

    fullclean() {
        const env = new BaseBoardEnv();
        env.removeBlueScriptDir();
    }
}

export async function handleFullcleanCommand(options: { force?: boolean }) {
    try {
        const fullcleanHandler = new FullcleanHandler();

        let confirmed = options.force;
        if (!confirmed) {
            const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: `Are you sure you want to delete entire board settings?`,
                default: false,
            },
            ]);
            confirmed = proceed;
        }
        if (!confirmed) {
            logger.warn('Fullclean process cancelled by user.');
            return;
        }

        // Fullclean
        fullcleanHandler.fullclean();

        logger.br();
        logger.success(`Success to delete entire settings.`);

    } catch (error) {
        logger.error(`Failed to delete entire settings.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerFullcleanCommand(program: Command) {
    program
        .command('fullclean')
        .description('delete entire board settings.')
        .option('-f, --force', 'skip confirmation prompt')
        .action(handleFullcleanCommand);
}