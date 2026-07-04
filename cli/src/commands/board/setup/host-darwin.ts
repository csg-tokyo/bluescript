import { SetupHandler } from "./base";
import { BoardName } from "../../../config/board-utils";
import { HostDarwinEnv } from "../../../platforms/board-env/host-env";
import { isPackageInstalledOnUnix } from "./utils";


export class HostDarwinSetupHandler extends SetupHandler {
    boardName: BoardName = 'host';
    boardEnv: HostDarwinEnv;

    constructor() {
        super();
        this.boardEnv = new HostDarwinEnv();
    }

    loadBoardSetupSteps(): void {
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

    async setBoardConfig() {
        this.globalConfigHandler.updateBoardConfig('host', {
            rootDir: this.boardEnv.hostRootDir,
            shellFile: this.boardEnv.shellFile,
            toolchain: {
                gcc: 'cc',
                ar: 'ar',
                make: 'make'
            },
        })
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await isPackageInstalledOnUnix("cc")) {
            throw new Error("Cannot find cc command. Please install cc and try again.");
        }
        if (!await isPackageInstalledOnUnix("make")) {
            throw new Error("Cannot find make command. Please install make and try again.");
        }
    }

    private async buildHostRuntimeStep() {
        await this.boardEnv.buildHostRuntime();
    }
}