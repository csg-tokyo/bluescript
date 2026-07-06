import { SetupHandler } from "./base";
import { execWithLog } from '../../../core/command-exec';
import { skip } from "../../../core/logger";
import * as path from 'path';
import { BoardName } from "../../../config/board-utils";
import { Esp32DarwinEnv, Esp32WindowsEnv } from "../../../platforms/board-env/esp32-env";


export class Esp32DarwinSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32DarwinEnv;
    pythonCommand?: string;
    makeCommand?: string;

    constructor() {
        super();
        this.boardEnv = new Esp32DarwinEnv();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: "Verify that git, python3, brew and make are installed.",
            actionMessage: "Verifying that git, python3 and brew are installed...",
            action: this.verifyPrerequisitsInstalledStep.bind(this),
        });
        this.setupSteps.push({
            description: "Install required packages via brew if they are not installed (cmake, ninja, dfu-util, and ccache).",
            actionMessage: "Installing required packages...",
            action: this.installRequiredPackagesStep.bind(this),
        });
        this.setupSteps.push({
            description: `Clone ESP-IDF ${this.boardEnv.idfVersion} from ${this.boardEnv.idfGitRepo}.`,
            actionMessage: `Cloning ESP-IDF ${this.boardEnv.idfVersion}... It may take a while.`,
            action: this.cloneEspIdfStep.bind(this),
        });
        this.setupSteps.push({
            description: "Run ESP-IDF install script.",
            actionMessage: "Running ESP-IDF install script...",
            action: this.runEspIdfInstallScriptStep.bind(this),
        });
    }

    async setBoardConfig() {
        const xtensaGccDir = await this.boardEnv.getXtensaGccDir(this.pythonCommand!);
        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: this.boardEnv.idfVersion,
            rootDir: this.boardEnv.espRootDir,
            exportFile: this.boardEnv.idfExportFile,
            toolchain: {
                gcc: path.join(xtensaGccDir, this.boardEnv.xtensaGccFileName),
                ar: path.join(xtensaGccDir, this.boardEnv.xtensaArFileName),
                ld: path.join(xtensaGccDir, this.boardEnv.xtensaLdFileName),
                make: this.makeCommand!,
                python: this.pythonCommand!
            },
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await this.boardEnv.isPackageInstalled("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        if (!await this.boardEnv.isPackageInstalled("brew")) {
            throw new Error("Cannot find brew command. Please install Homebrew and try again.");
        }
        this.pythonCommand = await this.boardEnv.getPythonCommand();
        this.makeCommand = await this.boardEnv.getMakeCommand();
    }

    private async installRequiredPackagesStep() {
        let packages: string[] = [];
        if (!(await this.boardEnv.isPackageInstalled('cmake'))) { packages.push('cmake'); }
        if (!(await this.boardEnv.isPackageInstalled('ninja'))) { packages.push('ninja'); }
        if (!(await this.boardEnv.isPackageInstalled('dfu-util'))) { packages.push('dfu-util'); }
        if (!(await this.boardEnv.isPackageInstalled('ccache'))) { packages.push('ccache'); }
        if (packages.length === 0) {
            return skip('already installed.');
        }
        await execWithLog('brew', ['install', ...packages]);
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
    }
}

export class Esp32WindowsSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32WindowsEnv;
    makeCommand?: string;
    pythonCommand?: string;

    constructor() {
        super();
        this.boardEnv = new Esp32WindowsEnv();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: "Verify that git, python3 and make are installed.",
            actionMessage: "Verifying that git and python3 are installed...",
            action: this.verifyPrerequisitsInstalledStep.bind(this),
        });
        this.setupSteps.push({
            description: `Clone ESP-IDF ${this.boardEnv.idfVersion} from ${this.boardEnv.idfGitRepo}.`,
            actionMessage: `Cloning ESP-IDF ${this.boardEnv.idfVersion}... It may take a while.`,
            action: this.cloneEspIdfStep.bind(this),
        });
        this.setupSteps.push({
            description: "Run ESP-IDF install script.",
            actionMessage: "Running ESP-IDF install script...",
            action: this.runEspIdfInstallScriptStep.bind(this),
        });
    }

    async setBoardConfig() {
        const xtensaGccDir = await this.boardEnv.getXtensaGccDir(this.pythonCommand!);
        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: this.boardEnv.idfVersion,
            rootDir: this.boardEnv.espRootDir,
            exportFile: this.boardEnv.idfExportFile,
            toolchain: {
                gcc: path.join(xtensaGccDir, this.boardEnv.xtensaGccFileName),
                ar: path.join(xtensaGccDir, this.boardEnv.xtensaArFileName),
                ld: path.join(xtensaGccDir, this.boardEnv.xtensaLdFileName),
                make: this.makeCommand!,
                python: this.pythonCommand!
            },
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        // git command
        if (!await this.boardEnv.isPackageInstalled("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        this.pythonCommand = await this.boardEnv.getPythonCommand();
        this.makeCommand = await this.boardEnv.getMakeCommand();
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
    }
}