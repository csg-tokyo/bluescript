import { SetupHandler } from "./base";
import { exec } from '../../../core/shell';
import { BoardName } from "../../../config/board-utils";
import { HostDarwinEnv } from "../../../platforms/board-env/host-env";


export class HostDarwinSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: HostDarwinEnv;

    constructor() {
        super();
        this.boardEnv = new HostDarwinEnv();
    }

    protected loadSetupSteps(): void {
        super.loadSetupSteps();
        this.setupSteps.push({
            description: "Verify that cc and make are installed.",
            actionMessage: "Verifying that cc and make are installed...",
            action: this.verifyPrerequisitsInstalledStep.bind(this),
        });
        this.setupSteps.push({
            description: "Build host runtime.",
            actionMessage: "Building host runtime...",
            action: this.buildHostRuntimeStep.bind(this),
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await this.isPackageInstalled("cc")) {
            throw new Error("Cannot find cc command. Please install cc and try again.");
        }
        if (!await this.isPackageInstalled("make")) {
            throw new Error("Cannot find make command. Please install make and try again.");
        }
    }

    private async buildHostRuntimeStep() {
        await this.boardEnv.buildHostRuntime();
    }

    private async isPackageInstalled(name: string) {
        try {
            await exec(`which ${name}`, { silent: true });
            return true;
        } catch (error) {
            return false;
        }
    }
}