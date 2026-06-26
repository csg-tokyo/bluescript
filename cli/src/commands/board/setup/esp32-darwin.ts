import { SetupHandler } from "./base";
import { exec } from '../../../core/shell';
import { skip } from "../../../core/logger";
import { BoardName } from "../../../config/board-utils";
import { Esp32DarwinEnv } from "../../../platforms/board-env/esp32-env";


export class Esp32DarwinSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32DarwinEnv;

    constructor() {
        super();
        this.boardEnv = new Esp32DarwinEnv();
    }

    protected loadSetupSteps(): void {
        super.loadSetupSteps();
        this.setupSteps.push({
            description: "Verify that git, python3 and brew are installed.",
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
            actionMessage: `Cloning ESP-IDF ${this.boardEnv.idfVersion} from ${this.boardEnv.idfGitRepo}... It may take a while.`,
            action: this.cloneEspIdfStep.bind(this),
        });
        this.setupSteps.push({
            description: "Run ESP-IDF install script.",
            actionMessage: "Running ESP-IDF install script...",
            action: this.runEspIdfInstallScriptStep.bind(this),
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await this.isPackageInstalled("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        if (!await this.isPackageInstalled("brew")) {
            throw new Error("Cannot find brew command. Please install Homebrew and try again.");
        }
        if (!(await this.isPythonVersionGreaterThan3()) && !(await this.isPackageInstalled('python3'))) {
            throw new Error("Cannot find python3. Please install Python3 and try again.");
        }
    }

    private async installRequiredPackagesStep() {
        let packages: string[] = [];
        if (!(await this.isPackageInstalled('cmake'))) { packages.push('cmake'); }
        if (!(await this.isPackageInstalled('ninja'))) { packages.push('ninja'); }
        if (!(await this.isPackageInstalled('dfu-util'))) { packages.push('dfu-util'); }
        if (!(await this.isPackageInstalled('ccache'))) { packages.push('ccache'); }
        if (packages.length === 0) {
            return skip('already installed.');
        }
        await exec(`brew install ${packages.join(' ')}`);
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
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
}