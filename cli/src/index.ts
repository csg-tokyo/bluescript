#!/usr/bin/env node

import { Command } from 'commander';
import { logger } from './core/logger';
import packageJson from '../package.json';

import { registerSetupCommand } from './commands/board/setup';
import { registerRemoveCommand } from './commands/board/remove';
import { registerFlashRuntimeCommand } from './commands/board/flash-runtime';
import { registerListCommand } from './commands/board/list';
import { registerCreateProjectCommand } from './commands/project/create';
import { registerRunCommand } from './commands/project/run';
import { registerFullcleanCommand } from './commands/board/full-clean';
import { registerReplCommand } from './commands/repl';
import { registerInstallCommand } from './commands/project/install';
import { registerUninstallCommand } from './commands/project/uninstall';
import { registerUpdateCommand } from './commands/board/update';


function registerBoardCommands(program: Command) {
    const boardCommand = program
        .command('board')
        .description('manage board environments and configurations');

    registerSetupCommand(boardCommand);
    registerRemoveCommand(boardCommand);
    registerFlashRuntimeCommand(boardCommand);
    registerListCommand(boardCommand);
    registerFullcleanCommand(boardCommand);
    registerUpdateCommand(boardCommand);
}

function registerProjectCommands(program: Command) {
    const projectCommand = program
        .command('project')
        .description('manage projects')
    
    registerCreateProjectCommand(projectCommand);
    registerRunCommand(projectCommand);
    registerInstallCommand(projectCommand);
    registerUninstallCommand(projectCommand);
}

function main() {
    const command = new Command();

    command
        .name('bscript')
        .description('A new CLI for the BlueScript microcontroller language')
        .version(packageJson.version, '-v, --version', 'Output the current version');

    registerBoardCommands(command);
    registerProjectCommands(command);
    registerReplCommand(command);

    command.parse(process.argv);
}

try {
    main();
} catch (error) {
    logger.error('An unexpected error occurred:');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}