import { SetupHandler } from "./base";
import { BoardName } from "../../../config/board-utils";
import { HostDarwinEnv, HostWindowsEnv } from "../../../platforms/board-env/host-env";


export class HostDarwinSetupHandler extends SetupHandler {
    boardName: BoardName = 'host';
    boardEnv: HostDarwinEnv;
    gccCommand?: string;
    arCommand?: string;
    makeCommand?: string;

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
        this.globalConfigHandler.setBoardConfig('host', {
            rootDir: this.boardEnv.hostRootDir,
            shellFile: this.boardEnv.shellFile,
            toolchain: {
                gcc: this.gccCommand!,
                ar: this.arCommand!,
                make: this.makeCommand!
            },
        })
    }

    private async verifyPrerequisitsInstalledStep() {
        this.gccCommand = await this.boardEnv.getGccCommand();
        this.arCommand = await this.boardEnv.getArCommand();
        this.makeCommand = await this.boardEnv.getMakeCommand();
    }

    private async buildHostRuntimeStep() {
        await this.boardEnv.buildHostRuntime();
    }
}

export class HostWindowsSetupHandler extends SetupHandler {
    boardName: BoardName = 'host';
    boardEnv: HostWindowsEnv;
    gccCommand?: string;
    arCommand?: string;
    makeCommand?: string;

    constructor() {
        super();
        this.boardEnv = new HostWindowsEnv();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: "Verify that MinGW is installed.",
            actionMessage: "Verifying that MinGW is installed...",
            action: this.verifyMingwIsInstalledStep.bind(this),
        });
        this.setupSteps.push({
            description: "Build host runtime.",
            actionMessage: "Building host runtime...",
            action: this.buildHostRuntimeStep.bind(this),
        });
    }

    async setBoardConfig() {
        this.globalConfigHandler.setBoardConfig('host', {
            rootDir: this.boardEnv.hostRootDir,
            shellFile: this.boardEnv.shellFile,
            toolchain: {
                gcc: this.gccCommand!,
                ar: this.arCommand!,
                make: this.makeCommand!
            },
        });
    }

    private async verifyMingwIsInstalledStep() {
        this.gccCommand = await this.boardEnv.getGccCommand();
        this.arCommand = await this.boardEnv.getArCommand();
        this.makeCommand = await this.boardEnv.getMakeCommand();
    }

    private async buildHostRuntimeStep() {
        await this.boardEnv.buildHostRuntime();
    }
}