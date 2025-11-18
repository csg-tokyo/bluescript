import { Command } from "commander";
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import { logger, LogStep, showErrorMessages, SkipStep } from "../../core/logger";
import { GLOBAL_BLUESCRIPT_PATH, GlobalConfigHandler } from "../../core/global-config";
import { BoardName } from "../../core/board-utils";
import { exec } from '../../core/shell';
import * as fs from '../../core/fs';
import chalk from "chalk";


const RUNTIME_VERSION = 'v1.1.4';
const RUNTIME_ZIP_URL = `https://github.com/csg-tokyo/bluescript/releases/download/${RUNTIME_VERSION}/release-microcontroller-${RUNTIME_VERSION}.zip`;
const GLOBAL_PACKAGES_ZIP_URL = `https://github.com/csg-tokyo/bluescript/releases/download/${RUNTIME_VERSION}/release-modules-${RUNTIME_VERSION}.zip`;
const RUNTIME_DIR = path.join(GLOBAL_BLUESCRIPT_PATH, 'microcontroller');
const GLOBAL_PACKAGES_DIR = path.join(GLOBAL_BLUESCRIPT_PATH, 'modules');

const ESP_IDF_VERSION = 'v5.4';
const ESP_IDF_GIT_REPO = 'https://github.com/espressif/esp-idf.git';
const ESP_ROOT_DIR = path.join(GLOBAL_BLUESCRIPT_PATH, 'esp');
const ESP_IDF_EXPORT_FILE = path.join(ESP_ROOT_DIR, 'esp-idf/export.sh');
const ESP_IDF_INSTALL_FILE = path.join(ESP_ROOT_DIR, 'esp-idf/install.sh');


abstract class SetupHandler {
    protected globalConfigHandler: GlobalConfigHandler;

    constructor() {
        this.globalConfigHandler = new GlobalConfigHandler();
    }

    getSetupPlan(): string[] {
        const plan: string[] = [];
        plan.push(`Download BlueScript runtime from ${RUNTIME_ZIP_URL}`);
        plan.push(`Download global packages from ${GLOBAL_PACKAGES_ZIP_URL}`);
        plan.push(...this.getBoardSetupPlan());
        return plan;
    }

    async setup(): Promise<void> {
        await this.downloadBlueScriptRuntime();
        await this.downloadGlobalPackages();
        await this.setupBoard();
    }

    private needToDownloadBlueScriptRuntime() {
        return this.globalConfigHandler.globalConfig.runtime === undefined;
    }

    private needToDownloadGlobalPackages() {
        return this.globalConfigHandler.globalConfig.globalPackagesDir === undefined;
    }

    @LogStep(`Downloading BlueScript runtime...`)
    private async downloadBlueScriptRuntime() {
        if (!this.needToDownloadBlueScriptRuntime()) {
           throw new SkipStep('already downloaded.', undefined);
        }

        if (fs.exists(RUNTIME_DIR)) {
            fs.removeDir(RUNTIME_DIR);
        }
        if (!fs.exists(GLOBAL_BLUESCRIPT_PATH)) {
            fs.makeDir(GLOBAL_BLUESCRIPT_PATH);
        }
        await fs.downloadAndUnzip(RUNTIME_ZIP_URL, GLOBAL_BLUESCRIPT_PATH);
        this.globalConfigHandler.updateGlobalConfig({runtime: {
            version: RUNTIME_VERSION,
            dir: RUNTIME_DIR
        }});
    }

    @LogStep(`Downloading global packages...`)
    private async downloadGlobalPackages() {
        if (!this.needToDownloadGlobalPackages()) {
            throw new SkipStep('already downloaded.', undefined);
        }

        if (fs.exists(GLOBAL_PACKAGES_DIR)) {
            fs.removeDir(GLOBAL_PACKAGES_DIR);
        }
        if (!fs.exists(GLOBAL_BLUESCRIPT_PATH)) {
            fs.makeDir(GLOBAL_BLUESCRIPT_PATH);
        }
        await fs.downloadAndUnzip(GLOBAL_PACKAGES_ZIP_URL, GLOBAL_BLUESCRIPT_PATH);
        this.globalConfigHandler.updateGlobalConfig({
            globalPackagesDir: GLOBAL_PACKAGES_DIR
        });
    }

    abstract needSetup(): boolean;

    abstract getBoardSetupPlan(): string[];

    abstract setupBoard(): Promise<void>;
}


type ESP32SupportedOS = 'macos';

export class ESP32SetupHandler extends SetupHandler {
    readonly boardName: BoardName = 'esp32';
    private os: ESP32SupportedOS;

    constructor() {
        super();
        this.os = this.checkAndGetOS();
    }

    private checkAndGetOS(): ESP32SupportedOS {
        if (os.platform() === 'darwin') {
            return 'macos';
        } else {
            throw new Error('Unsupported OS.');
        }
    }

    needSetup(): boolean {
        return !this.globalConfigHandler.isBoardSetup(this.boardName);
    }

    getBoardSetupPlan(): string[] {
        let plan: string[] = [];
        if (this.os === 'macos') {
            plan.push('Install required packages via Homebrew or MacPorts if they are not installed (cmake, ninja, dfu-util, and ccache).');
            plan.push('Install Python3 via Homebrew or MacPorts if python version is not greater than 3 or python3 is not installed.');
        } else {
            throw new Error('Unknown OS.');
        }
        plan.push(`Clone ESP-IDF ${ESP_IDF_VERSION} from ${ESP_IDF_GIT_REPO}.`);
        plan.push('Run ESP-IDF install script.');
        return plan;
    }

    async setupBoard(): Promise<void> {
        await this.installEspidfRequiredPackages();
        await this.installPython3();
        await this.cloneEspIdf();
        await this.runEspIdfInstallScript();

        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: ESP_IDF_VERSION,
            rootDir: ESP_ROOT_DIR,
            exportFile: ESP_IDF_EXPORT_FILE,
            xtensaGccDir: await this.getXtensaGccDir(),
        });
        this.globalConfigHandler.saveGlobalConfig();
    }

    @LogStep('Installing required packages...')
    private async installEspidfRequiredPackages() {
        let packages: string[] = [];
        if (!(await this.isPackageInstalled('cmake'))) { packages.push('cmake'); }
        if (!(await this.isPackageInstalled('ninja'))) { packages.push('ninja'); }
        if (!(await this.isPackageInstalled('dfu-util'))) { packages.push('dfu-util'); }
        if (!(await this.isPackageInstalled('ccache'))) { packages.push('ccache'); }
        if (packages.length === 0) {
            throw new SkipStep('already installed.', undefined);
        }

        let installer: string;
        if (await this.isPackageInstalled('brew')) {
            installer = 'brew';
        } else if (await this.isPackageInstalled('port')) {
            installer = 'port';
        } else {
            throw new Error('Cannot find package installer.  Please install Homebrew or MacPorts and try again.');
        }

        await exec(`${installer} install ${packages.join(' ')}`);
    }

    @LogStep('Installing Python3...')
    private async installPython3() {
        if ((await this.isPythonVersionGreaterThan3()) || (await this.isPackageInstalled('python3'))) {
            throw new SkipStep('already installed.', undefined);
        }

        if (await this.isPackageInstalled('brew')) {
            await exec('brew install python3');
        } else if (await this.isPackageInstalled('port')) {
            await exec('sudo port install python38');
        } else {
            throw new Error('Cannot find package installer.  Please install Homebrew or MacPorts and try again.');
        }
    }

    private async isPackageInstalled(name: string) {
        try {
            await exec(`which ${name}`, { silent: true });
            return true;
        } catch (error) {
            return false;
        }
    }

    private async isPythonVersionGreaterThan3() {
        try {
            const result = await exec(`python --version`, { silent: true });
            return result.startsWith('Python 3.');
        } catch (error) {
            return false;
        }
    }

    @LogStep(
        `Cloning ESP-IDF ${ESP_IDF_VERSION} from ${ESP_IDF_GIT_REPO}... It may take a while.`
    )
    private async cloneEspIdf() {
        if (fs.exists(ESP_ROOT_DIR)) {
            fs.removeDir(ESP_ROOT_DIR);
        }
        if (!(await this.isPackageInstalled('git'))) {
            throw new Error('Cannot find git command. Please install git and try again.');
        }

        fs.makeDir(ESP_ROOT_DIR);
        await exec(`git clone -b ${ESP_IDF_VERSION} --recursive ${ESP_IDF_GIT_REPO}`, { cwd: ESP_ROOT_DIR });
    }

    @LogStep('Running ESP-IDF install script...')
    private async runEspIdfInstallScript() {
        await exec(ESP_IDF_INSTALL_FILE);
    }

    private async getXtensaGccDir() {
        try {
            const gccPath = await exec(`source ${ESP_IDF_EXPORT_FILE} && which xtensa-esp32-elf-gcc`, { silent:true });
            return path.dirname(gccPath);
        } catch (error) {
            throw new Error('Failed to get xtensa gcc path.', {cause: error});
        }
        
    }
}


function getSetupHandler(board: string): SetupHandler {
        if (board === 'esp32') {
            return new ESP32SetupHandler();
        } else {
            throw new Error(`Unsupported board name: ${board}`);
        }
}

export async function handleSetupCommand(board: string) {
    try {
        const setupHandler = getSetupHandler(board);

        // Check if setup has already been completed.
        if (!setupHandler.needSetup()) {
            logger.warn(`The setup for ${board} has already been completed.`);
            return;
        }

        // Ask user if it's ok to proceed with setup.
        const setupPlan = setupHandler.getSetupPlan();
        logger.log('The following setup process will be executed:');
        setupPlan.forEach(step => logger.log(`  - ${step}`));
        const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: 'Do you want to continue?',
                default: true,
            },
        ]);
        if (!proceed) {
            logger.warn('Setup cancelled by user.');
            return;
        }

        // Setup
        await setupHandler.setup();

        logger.br();
        logger.success(`Success to se tup ${board}`);
        logger.info(`Next step: run ${chalk.yellow(`bluescript board flash-runtime ${board}`)}`);

    } catch (error) {
        logger.error(`Failed to set up ${board}`);
        showErrorMessages(error);
        process.exit(1);
    }
}


export function registerSetupCommand(program: Command) {
    program
        .command('setup')
        .description('set up the environment for a specific board')
        .argument('<board-name>', 'name of the board to setup (e.g., esp32)') 
        .action(handleSetupCommand);
}



