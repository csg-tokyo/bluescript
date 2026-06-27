import { Command } from "commander";
import inquirer from 'inquirer';
import { BoardName, isValidBoard } from "../../config/board-utils";
import { logger, runStep } from "../../core/logger";
import { CommandHandler } from "../command";
import { CommonBoardEnv, createBoardEnv } from "../../platforms/board-env";


class RemoveHandler extends CommandHandler {
    boardName: BoardName;
    boardEnv: CommonBoardEnv;

    constructor(boardName: BoardName) {
        super();
        this.boardName = boardName;
        this.boardEnv = createBoardEnv(boardName);
    }

    async remove() {
        await runStep('Removing...', async () => this.boardEnv.removeBoardRoot());
        this.globalConfigHandler.removeBoardConfig(this.boardName);
        this.globalConfigHandler.save();
    }
    
    isSetup(): boolean {
        return this.globalConfigHandler.isBoardSetup(this.boardName);
    }
}

export async function handleRemoveCommand(board: string, options: { force?: boolean }) {
    try {
        if (!isValidBoard(board)) {
            throw new Error(`Unsupported board name: ${board}`);
        }
        const removeHandler = new RemoveHandler(board);

        // Check if setup has already been completed.
        if (!removeHandler.isSetup()) {
            logger.warn(`The environment for ${board} is not set up. Nothing to remove.`);
            return;
        }

        // Ask user if it's ok to proceed with remove.
        let confirmed = options.force;
        if (!confirmed) {
            const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: `Are you sure you want to remove the entire environment for ${board}?`,
                default: false,
            },
            ]);
            confirmed = proceed;
        }

        if (!confirmed) {
            logger.warn('Removal process cancelled by user.');
            return;
        }

        // Remove
        await removeHandler.remove();

        logger.br();
        logger.success(`Success to remove ${board}`);

    } catch (error) {
        logger.error(`Failed to remove ${board}`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerRemoveCommand(program: Command) {
    program
        .command('remove')
        .description('remove the environment for the specified board')
        .argument('<board-name>', 'name of the board to remove (e.g., esp32)') 
        .option('-f, --force', 'skip confirmation prompt')
        .action(handleRemoveCommand);
}