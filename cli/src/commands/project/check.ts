import { Command } from "commander";
import { logger, runStep } from "../../core/logging";
import { ProjectConfigHandler } from "../../config/project-config";
import { cwd } from "../../core/shell";
import { CommandHandler } from "../command";
import { CompilerAdapter, getCompilerAdapter } from "../../platforms";

class CheckHandler extends CommandHandler {
    private compilerAdapter: CompilerAdapter;

    constructor(private projectConfigHandler: ProjectConfigHandler) {
        super();

        const boardName = this.projectConfigHandler.getBoardName();
        this.compilerAdapter = getCompilerAdapter(boardName, this.globalConfigHandler, this.projectConfigHandler);
    }

    async check() {
        await runStep('Compiling...', () => this.compilerAdapter.buildForCheck());
    }
}

export async function handleCheckCommand() {
    try {
        const projectConfigHandler = ProjectConfigHandler.load(cwd());
        const handler = new CheckHandler(projectConfigHandler);
        await handler.check();

        logger.br();
        logger.success('Successfully checked BlueScript program.');
    } catch (error) {
        logger.error(`Failed to check BlueScript program.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerCheckCommand(program: Command) {
    program
        .command('check')
        .description('check your project')
        .action(handleCheckCommand);
}
