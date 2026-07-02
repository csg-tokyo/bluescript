import { SetupHandler } from "./base";
import { exec } from '../../../core/shell';
import { skip } from "../../../core/logger";
import { BoardName } from "../../../config/board-utils";
import { Esp32DarwinEnv, Esp32WindowsEnv } from "../../../platforms/board-env/esp32-env";


export class Esp32WindowsSetupHandler extends SetupHandler {
    boardName: BoardName = "host";
    boardEnv: Esp32WindowsEnv;

    constructor() {
        super();
        this.boardEnv = new Esp32WindowsEnv();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: "Verify that git and python3 are installed.",
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
        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: this.boardEnv.idfVersion,
            rootDir: this.boardEnv.espRootDir,
            exportFile: this.boardEnv.idfExportFile,
            xtensaGccDir: await this.boardEnv.getXtensaGccDir(),
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await this.isPackageInstalled("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        if (!(await this.isPythonVersionGreaterThan3()) && !(await this.isPackageInstalled('python3'))) {
            throw new Error("Cannot find python3. Please install Python3 and try again.");
        }
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
    }

    private async isPackageInstalled(name: string) {
        // try {
        //     await exec(`which ${name}`, { silent: true });
        //     return true;
        // } catch (error) {
        //     return false;
        // }
        // TODO
        return true;
    }

    private async isPythonVersionGreaterThan3() {
        // try {
        //     const result = await exec(`python --version`, { silent: true });
        //     return result.startsWith('Python 3.');
        // } catch (error) {
        //     return false;
        // }
        // TODO
        return false;
    }
}