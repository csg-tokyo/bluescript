import { Command } from "commander";
import { logger, showErrorMessages } from "../../core/logger";
import { LOCAL_PACKAGES_DIR, ProjectConfigHandler, PackageSource } from "../../config/project-config";
import { GLOBAL_BLUESCRIPT_PATH } from "../../config/global-config";
import { cwd, exec } from "../../core/shell";
import * as fs from '../../core/fs';
import * as path from 'path';


class InstallationHandler {
    private projectConfigHandler: ProjectConfigHandler;
    private projectRootDir: string;
    private packagesDir: string;

    constructor() {
        this.projectRootDir = cwd();
        this.projectConfigHandler = ProjectConfigHandler.load(this.projectRootDir);
        this.packagesDir = LOCAL_PACKAGES_DIR(this.projectRootDir);
    }

    public async installAll() {
        this.ensurePackageDir();
        await this.processInstallQueue(this.projectConfigHandler.getDepenencies());
    }

    public async installPackage(url: string, version?: string) {
        this.ensurePackageDir();
        const packageConfigHandler = await this.downloadPackage(url, version);
        const packageName = packageConfigHandler.getConfig().projectName;
        await this.processInstallQueue(packageConfigHandler.getDepenencies());
        this.projectConfigHandler.addDependency({name: packageName, url, version});
        this.projectConfigHandler.save(this.projectRootDir);
    }

    private async processInstallQueue(queue: PackageSource[]) {
        const installedPackages = new Set<string>();

        while (queue.length > 0) {
            const currentPkg = queue.shift();
            if (!currentPkg) break;
            if (installedPackages.has(currentPkg.name)) continue;

            const pkgConfigHandler = await this.downloadPackage(currentPkg.url, currentPkg.version);
            pkgConfigHandler.checkVmVersion(this.projectConfigHandler.getConfig().vmVersion);
            installedPackages.add(currentPkg.name);
            pkgConfigHandler.getDepenencies().forEach((pkgDep) => {
                installedPackages.add(pkgDep.name);
            });        
        }
    }

    private ensurePackageDir() {
        if (!fs.exists(this.packagesDir)) {
            fs.makeDir(this.packagesDir);
        }
    }

    private async downloadPackage(url: string, version?: string): Promise<ProjectConfigHandler> {
        logger.log(`Downloading from ${url}...`);
        const tmpDir = path.join(GLOBAL_BLUESCRIPT_PATH, 'tmp-package');
        const branchCmd = version ? `--branch ${version}` : '';
        const cmd = `git clone --depth 1 ${branchCmd} ${url} ${tmpDir}`;
        try {
            await exec(cmd, {silent: true});
            const gitDir = path.join(tmpDir, '.git');
            if (fs.exists(gitDir)) {
                fs.removeDir(gitDir);
            }
            const configHandler = ProjectConfigHandler.load(tmpDir);
            const packageName = configHandler.getConfig().projectName;
            const packageDir = path.join(this.packagesDir, packageName);
            if (fs.exists(packageDir)) {
                fs.removeDir(packageDir);
            }
            fs.moveDir(tmpDir, packageDir);
            return configHandler;
        } catch (error) {
            if (fs.exists(tmpDir)) {
                fs.removeDir(tmpDir);
            }
            throw new Error(`Failed to download package from '${url}'.`, {cause: error});
        }
  }
}


export async function handleInstallCommand(url: string|undefined, options: {tag?: string}) {
    try {
        const installationHandler = new InstallationHandler();
        if (url) {
            installationHandler.installPackage(url, options.tag);
        } else {
            installationHandler.installAll();
        }
    } catch (error) {
        const errorMessage = 
            url ? `Failed to install ${url}.` : `Failed to install packages.`;
        logger.error(errorMessage);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerInstallCommand(program: Command) {
    program
        .command('install')
        .description('install all dependencies, or add a new package via Git URL')
        .argument('[git-url]', 'git repository URL to add as a dependency')
        .option('-t, --tag <tag>', 'git tag or branch to checkout (e.g., v1.0.0)')
        .action(handleInstallCommand);
}