#!/usr/bin/env node

import { Command } from 'commander';
import { join } from 'path';
import * as fs from './core/fs';
import { logger } from './cli/utils';

import { registerSetupCommand } from './commands/board/setup';
import { registerRemoveCommand } from './commands/board/remove';
import { registerFlashRuntimeCommand } from './commands/board/flash-runtime';
import { registerListCommand } from './commands/board/list';
import { registerCreateProjectCommand } from './commands/create-project';


function registerBoardCommands(program: Command) {
    const boardCommand = program
        .command('board')
        .description('manage board environments and configurations');

    registerSetupCommand(boardCommand);
    registerRemoveCommand(boardCommand);
    registerFlashRuntimeCommand(boardCommand);
    registerListCommand(boardCommand);
}

function main() {
    const command = new Command();

    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFile(packageJsonPath));

    command
        .name('bluescript')
        .description('A new CLI for the BlueScript microcontroller language')
        .version(packageJson.version, '-v, --version', 'Output the current version');

    registerBoardCommands(command);
    registerCreateProjectCommand(command);

    command.parse(process.argv);
}

try {
    main();
} catch (error) {
    logger.error('An unexpected error occurred:');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}