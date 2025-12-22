import { Command } from "commander";
import { logger, showErrorMessages } from "../../core/logger";
import { LOCAL_PACKAGES_DIR, ProjectConfigHandler } from "../../config/project-config";
import { cwd } from "../../core/shell";
import * as fs from '../../core/fs';
import * as path from 'path';


export async function handleUninstallCommand(packageName: string) {
    try {
        const projectRootDir = cwd();
        const projectConfigHandler = ProjectConfigHandler.load(projectRootDir);
        const packageDir = path.join(LOCAL_PACKAGES_DIR(projectRootDir), packageName);
        if (!projectConfigHandler.dependencyExists(packageName)) {
            throw new Error(`Package ${packageName} is not listed in bsconfig.json dependencies.`)
        }
        if (fs.exists(packageDir)) {
            fs.removeDir(packageDir);
        }
        projectConfigHandler.removeDepedency(packageName);
        projectConfigHandler.save(projectRootDir);
    } catch (error) {
        logger.error(`Failed to uninstall ${packageName}.`);
        showErrorMessages(error);
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