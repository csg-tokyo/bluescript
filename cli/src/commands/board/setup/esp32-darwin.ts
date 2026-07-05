import { SetupHandler } from "./base";
import { execWithLog } from '../../../core/command-exec';
import { skip } from "../../../core/logger";
import * as path from 'path';
import { BoardName } from "../../../config/board-utils";
import { Esp32DarwinEnv } from "../../../platforms/board-env/esp32-env";
import { isPackageInstalledOnUnix, isPythonVersionGreaterThan3 } from "./utils";


export class Esp32DarwinSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32DarwinEnv;
    pythonCommand?: string;

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
                make: 'make',
                python: this.pythonCommand!
            },
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await isPackageInstalledOnUnix("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        if (!await isPackageInstalledOnUnix("brew")) {
            throw new Error("Cannot find brew command. Please install Homebrew and try again.");
        }
        if (await isPythonVersionGreaterThan3()) {
            this.pythonCommand = 'python';
        } else if (await isPackageInstalledOnUnix('python3')) {
            this.pythonCommand = 'python3';
        } else {
            throw new Error("Cannot find Python3. Please install Python3 and try again.");
        }
        if (!await isPackageInstalledOnUnix("make")) {
            throw new Error("Cannot find make command. Please install make and try again.");
        }
    }

    private async installRequiredPackagesStep() {
        let packages: string[] = [];
        if (!(await isPackageInstalledOnUnix('cmake'))) { packages.push('cmake'); }
        if (!(await isPackageInstalledOnUnix('ninja'))) { packages.push('ninja'); }
        if (!(await isPackageInstalledOnUnix('dfu-util'))) { packages.push('dfu-util'); }
        if (!(await isPackageInstalledOnUnix('ccache'))) { packages.push('ccache'); }
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