import { Command } from "commander";
import inquirer from 'inquirer';
import { BoardName } from "../../config/board-utils";
import { logger, LogStep, showErrorMessages } from "../../core/logger";
import * as fs from '../../core/fs';
import { CommandHandler } from "../command";


abstract class RemoveHandler extends CommandHandler {
    async remove() {
        await this.removeBoard();
        this.globalConfigHandler.save();
    }
    abstract isSetup(): boolean;
    abstract removeBoard(): Promise<void>;
}

class ESP32RemoveHandler extends RemoveHandler {
    readonly boardName: BoardName = 'esp32';

    isSetup(): boolean {
        return this.globalConfigHandler.isBoardSetup(this.boardName);
    }
    
    @LogStep(`Removing...`)
    async removeBoard() {
        const boardConfig = this.globalConfigHandler.getBoardConfig(this.boardName);
        if (boardConfig === undefined) {
            throw new Error(`Cannot find config for ${this.boardName}.`);
        }
        if (fs.exists(boardConfig.rootDir)) {
            fs.removeDir(boardConfig.rootDir);
        }

        this.globalConfigHandler.removeBoardConfig(this.boardName);
    }
}

function getRemoveHandler(board: string) {
    if (board === 'esp32') {
        return new ESP32RemoveHandler();
    } else {
        throw new Error(`Unsupported board name: ${board}`);
    }
}

export async function handleRemoveCommand(board: string, options: { force?: boolean }) {
    try {
        const removeHandler = getRemoveHandler(board);

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
        showErrorMessages(error);
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