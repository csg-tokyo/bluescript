import { Command } from "commander";
import { logger, showErrorMessages } from "../core/logger";
import { LOCAL_PACKAGES_DIR, ProjectConfigHandler, PackageSource } from "../config/project-config";
import { GLOBAL_BLUESCRIPT_PATH } from "../config/global-config";
import { cwd, exec } from "../core/shell";
import * as fs from '../core/fs';
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

    public async installPackage(identifier: string) {
        this.ensurePackageDir();
        const {url, version} = this.resolveIdentifier(identifier);
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

    private resolveIdentifier(identifier: string): {url: string, version?: string} {
        // Separate version specification.
        // npm style: package@version, git style: url#version
        let rawPath = identifier;
        let version: string | undefined = undefined;

        if (identifier.includes('#')) {
            const parts = identifier.split('#');
            rawPath = parts[0];
            version = parts[1];
        } else if (identifier.includes('@') && !identifier.startsWith('git@')) {
            // Exclude SSH URL like git@github.com...
            const lastIndex = identifier.lastIndexOf('@');
            if (lastIndex > 0) {
                rawPath = identifier.substring(0, lastIndex);
                version = identifier.substring(lastIndex + 1);
            }
        }

        const isUrl = 
            rawPath.startsWith('http://') || 
            rawPath.startsWith('https://') || 
            rawPath.startsWith('git@') ||
            rawPath.startsWith('ssh://');

        let url: string;
        if (isUrl) {
            url = rawPath;
        } else {
            // GitHub short hand (user/repo)
            const parts = rawPath.split('/');
            if (parts.length !== 2) {
                throw new Error(`Invalid package format: '${identifier}'. Use 'user/repo' or a valid Git URL.`);
            }
            url = `https://github.com/${rawPath}.git`;
        }

        return {url, version};
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


export async function handleInstallCommand(packageName?: string) {
    try {
        const installationHandler = new InstallationHandler();
        if (packageName) {
            installationHandler.installPackage(packageName);
        } else {
            installationHandler.installAll();
        }
    } catch (error) {
        const errorMessage = 
            packageName ? `Failed to install ${packageName}.` : `Failed to install packages.`;
        logger.error(errorMessage);
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerInstallCommand(program: Command) {
    program
        .command('install')
        .description('install dependencies from bsconfig.json or add a new package')
        .argument('[package-name]', 'Package name (e.g., user/repo) or Git URL')
        .action(handleInstallCommand);
}