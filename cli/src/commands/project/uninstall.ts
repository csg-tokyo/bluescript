import { Command } from "commander";
import { logger } from "../../core/logger";
import { ProjectConfigHandler, PROJECT_DEFAULT_PATHS } from "../../config/project-config";
import { cwd } from "../../core/shell";
import * as fs from '../../core/fs';
import * as path from 'path';
import { CommandHandler } from "../command";


class UninstallHandler extends CommandHandler {
    private projectDir: string;
    private projectConfigHandler: ProjectConfigHandler;

    constructor(projectDir: string) {
        super();
        this.projectDir = projectDir;
        this.projectConfigHandler = ProjectConfigHandler.load(projectDir);
    }

    uninstall(packageName: string) {
        const packageDir = path.join(this.projectDir, PROJECT_DEFAULT_PATHS.PACKAGES_DIR, packageName);
        if (!this.projectConfigHandler.dependencyExists(packageName)) {
            throw new Error(`Package ${packageName} is not listed in bsconfig.json dependencies.`)
        }
        if (fs.exists(packageDir)) {
            fs.removeDir(packageDir);
        }
        this.projectConfigHandler.removeDepedency(packageName);
        this.projectConfigHandler.save(this.projectDir);
    }
}

export async function handleUninstallCommand(packageName: string) {
    try {
        const projectDir = cwd();
        const uninstallHandler = new UninstallHandler(projectDir);
        uninstallHandler.uninstall(packageName);
    } catch (error) {
        logger.error(`Failed to uninstall ${packageName}.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerUninstallCommand(program: Command) {
    program
        .command('uninstall')
        .description('remove the specified package from your project')
        .argument('<package-name>', 'Package name')
        .action(handleUninstallCommand);
}