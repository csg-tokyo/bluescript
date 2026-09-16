import { Command } from "commander";
import inquirer from 'inquirer';
import { BoardName, isValidBoard, isEsp32FamilyBoard, ESP32_FAMILY_BOARD_NAMES } from "../../config/board-utils";
import { logger, runStep, skip } from "../../core/logger";
import { CommandHandlerWithUpdateCheck } from "../command";
import { BoardEnv, createBoardEnv } from "../../platforms/board-env";


class RemoveHandler extends CommandHandlerWithUpdateCheck {
    boardName: BoardName;
    boardEnv: BoardEnv;

    constructor(boardName: BoardName) {
        super();
        this.boardName = boardName;
        this.boardEnv = createBoardEnv(boardName);
    }

    async remove() {
        await runStep('Removing...', async () => {
            if (this.isBoardRootShared()) {
                return skip(`the ESP-IDF installation is still used by ${this.otherBoardsSharingRoot().join(', ')}.`);
            }
            this.boardEnv.removeBoardRoot();
        });
        this.globalConfigHandler.removeBoardConfig(this.boardName);
        this.globalConfigHandler.save();
    }

    // Boards of the ESP32 family share one ESP-IDF installation.
    private otherBoardsSharingRoot(): BoardName[] {
        if (!isEsp32FamilyBoard(this.boardName)) {
            return [];
        }
        return ESP32_FAMILY_BOARD_NAMES.filter(
            b => b !== this.boardName && this.globalConfigHandler.isBoardSetup(b));
    }

    private isBoardRootShared(): boolean {
        return this.otherBoardsSharingRoot().length > 0;
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
        .argument('<board-name>', 'name of the board to remove (e.g., esp32, esp32s3)') 
        .option('-f, --force', 'skip confirmation prompt')
        .action(handleRemoveCommand);
}