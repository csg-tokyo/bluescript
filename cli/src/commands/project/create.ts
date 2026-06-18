import { Command } from "commander";
import inquirer from 'inquirer';
import chalk from "chalk";
import * as path from 'path';
import { logger } from "../../core/logger";
import { ProjectConfigHandler } from "../../config/project-config";
import { cwd } from "../../core/shell";
import { BOARD_NAMES, BoardName, isValidBoard } from "../../config/board-utils";
import * as fs from '../../core/fs';
import { CommandHandler } from "../command";


const ENTRY_FILE_CONTENTS = `console.log("Hello world!");\n`;
const GIT_IGNORE_CONTENTS = `\
**/dist/
**/packages/
`;

class CreateHandler extends CommandHandler {
    private board: BoardName;
    private projectRoot: string;
    private projectConfigHandler: ProjectConfigHandler;
    private srcDir: string = './src';
    private entryFile: string = './src/index.bs';

    constructor(projectName: string, board: BoardName) {
        super();
        this.board = board;
        this.projectRoot = path.join(cwd(), projectName);
        this.projectConfigHandler = ProjectConfigHandler.createTemplate(projectName, board, this.projectRoot);
        this.projectConfigHandler.update({
            srcDir: this.srcDir,
            entryFile: this.entryFile,
        });
    }

    isBoardSetup() {
        return this.globalConfigHandler.isBoardSetup(this.board);
    } 

    create() {
        this.createProjectDir();
        this.createGitIgnore();
        this.createSourceDir();
        this.createEntryFile();
        this.projectConfigHandler.save(this.projectRoot);
    }

    private createProjectDir() {
        if (fs.exists(this.projectRoot)) {
            throw new Error(`${this.projectRoot} already exists.`);
        }
        fs.makeDir(this.projectRoot);
    }

    private createSourceDir() {
        fs.makeDir(path.join(this.projectRoot, this.srcDir));
    }

    private createEntryFile() {
        fs.writeFile(path.join(this.projectRoot, this.entryFile), ENTRY_FILE_CONTENTS);
    }

    private createGitIgnore() {
        const filePath = path.join(this.projectRoot, '.gitignore');
        fs.writeFile(filePath, GIT_IGNORE_CONTENTS);
    }
}

export async function handleCreateProjectCommand(name: string, options: { board?: string }) {
    try {
        let selectedBoard: string;
        if (options.board) {
            selectedBoard = options.board;
        } else {
            const { board } = await inquirer.prompt<{ board: string }>([
                {
                    type: 'list',
                    name: 'board',
                    message: 'Select the board name',
                    choices: BOARD_NAMES,
                },
            ]);
            selectedBoard = board;
        }
        if (!isValidBoard(selectedBoard)) {
            throw new Error(`Unsupported board name: ${selectedBoard}`);
        }

        const createHandler = new CreateHandler(name, selectedBoard);

        if (!createHandler.isBoardSetup()) {
            throw new Error(`The environment for ${selectedBoard} is not set up.`);
        }

        createHandler.create();

        logger.br();
        logger.success(`Success to create a new project.`);
        logger.info(`Next step: go to the project directory and run ${chalk.yellow('bscript project run')}`);
    } catch (error) {
        logger.error(`Failed to create a new project.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerCreateProjectCommand(program: Command) {
    program
        .command('create')
        .description('create a new project')
        .argument('<project-name>', 'name of the new project')
        .option('-b, --board <board>', 'board name')
        .action(handleCreateProjectCommand);
}