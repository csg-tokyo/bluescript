import { Command } from "commander";
import inquirer from 'inquirer';
import chalk from "chalk";
import * as path from 'path';
import { logger, showErrorMessages } from "../core/logger";
import { DEFAULT_MAIN_FILE_NAME, ProjectConfigHandler } from "../config/project-config";
import { cwd } from "../core/shell";
import { BOARD_NAMES, isValidBoard } from "../config/board-utils";
import * as fs from '../core/fs';

const MAIN_TEMPLATE = `print('Hello world!')`;

function createProjectDir(projectName: string) {
    const projectDir = path.join(cwd(), projectName);
    if (fs.exists(projectDir)) {
        throw new Error(`${projectDir} already exists.`);
    }
    fs.makeDir(projectDir);
    return projectDir;
}

function createMainFile(dir: string) {
    const filePath = path.join(dir, DEFAULT_MAIN_FILE_NAME);
    fs.writeFile(filePath, MAIN_TEMPLATE);
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

        const projectDir = createProjectDir(name);
        
        const projectConfigHandler = ProjectConfigHandler.createTemplate(name, selectedBoard);
        projectConfigHandler.save(projectDir);
        
        createMainFile(projectDir);

        logger.br();
        logger.success(`Success to create a new project.`);
        logger.info(`Next step: go to the project directory and run ${chalk.yellow('bluescript run')}`);
    } catch (error) {
        logger.error(`Failed to create a new project.`);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerCreateProjectCommand(program: Command) {
    program
        .command('create-project')
        .description('create a new project.')
        .argument('<project-name>', 'name of the new project')
        .option('-b, --board <board>', 'board name')
        .action(handleCreateProjectCommand);
}