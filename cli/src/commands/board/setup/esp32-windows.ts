import { SetupHandler } from "./base";
import * as path from 'path';
import { BoardName } from "../../../config/board-utils";
import { Esp32WindowsEnv } from "../../../platforms/board-env/esp32-env";
import { isPackageInstalledOnWindows, isPythonVersionGreaterThan3 } from "./utils";

export class Esp32WindowsSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32WindowsEnv;
    makeCommand?: string;

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
            actionMessage: `Cloning ESP-IDF ${this.boardEnv.idfVersion} from ${this.boardEnv.idfGitRepo}... It may take a while.`,
            action: this.cloneEspIdfStep.bind(this),
        });
        this.setupSteps.push({
            description: "Run ESP-IDF install script.",
            actionMessage: "Running ESP-IDF install script...",
            action: this.runEspIdfInstallScriptStep.bind(this),
        });
    }

    async setBoardConfig() {
        const xtensaGccDir = await this.boardEnv.getXtensaGccDir();
        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: this.boardEnv.idfVersion,
            rootDir: this.boardEnv.espRootDir,
            exportFile: this.boardEnv.idfExportFile,
            toolchain: {
                gcc: path.join(xtensaGccDir, this.boardEnv.xtensaGccFileName),
                ar: path.join(xtensaGccDir, this.boardEnv.xtensaArFileName),
                ld: path.join(xtensaGccDir, this.boardEnv.xtensaLdFileName),
                make: this.makeCommand!
            },
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await isPackageInstalledOnWindows("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        if (!(await isPythonVersionGreaterThan3()) && !(await isPackageInstalledOnWindows('python3'))) {
            throw new Error("Cannot find python3. Please install Python3 and try again.");
        }

        // make command
        if (await isPackageInstalledOnWindows('make')) {
            this.makeCommand = 'make';
        } else if (await isPackageInstalledOnWindows('mingw32-make')) {
            this.makeCommand = 'mingw32-make';
        } else {
            throw new Error("Cannot find make or mingw32-make command. Please install make or mingw32-make and try again.");
        }
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
    }
}