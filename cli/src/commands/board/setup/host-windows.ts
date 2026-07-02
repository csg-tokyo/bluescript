import { SetupHandler } from "./base";
import { exec } from '../../../core/shell';
import { BoardName } from "../../../config/board-utils";
import { HostWindowsEnv } from "../../../platforms/board-env/host-env";


export class HostWindowsSetupHandler extends SetupHandler {
    boardName: BoardName = 'host';
    boardEnv: HostWindowsEnv;

    constructor() {
        super();
        this.boardEnv = new HostWindowsEnv();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: "Verify that MinGW is installed.", // write version
            actionMessage: "Verifying that MinGW is installed...",
            action: this.installMinGWStep.bind(this),
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
            gccCommand: 'gcc',
            makeCommand: 'mingw32-make',
            arCommand: 'ar'
        })
    }
    private async installMinGWStep() {
        // TODO
    }

    private async buildHostRuntimeStep() {
        await this.boardEnv.buildHostRuntime();
    }

    private async isPackageInstalled(name: string) {
        // TODO
    }
}