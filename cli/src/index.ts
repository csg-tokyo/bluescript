#!/usr/bin/env node

import { Command } from 'commander';
import { join } from 'path';
import * as fs from './core/fs';
import { logger } from './cli/utils';

import { registerSetupCommand } from './commands/board/setup';
import { registerRemoveCommand } from './commands/board/remove';

function main() {
    const program = new Command();

    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFile(packageJsonPath));

    program
        .name('bluescript')
        .description('A new CLI for the BlueScript microcontroller language')
        .version(packageJson.version, '-v, --version', 'Output the current version');

    const programBoard = program
        .command('board')
        .description('Command for handling board');

    registerSetupCommand(programBoard);
    registerRemoveCommand(programBoard)

    program.parse(process.argv);
}

try {
    main();
} catch (error) {
    logger.error('An unexpected error occurred:');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}