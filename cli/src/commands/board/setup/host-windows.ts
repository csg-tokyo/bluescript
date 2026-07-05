import { SetupHandler } from "./base";
import { exec } from '../../../core/shell';
import { BoardName } from "../../../config/board-utils";
import { HostWindowsEnv } from "../../../platforms/board-env/host-env";
import { isPackageInstalledOnWindows } from "./utils";


export class HostWindowsSetupHandler extends SetupHandler {
    boardName: BoardName = 'host';
    boardEnv: HostWindowsEnv;

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
        this.globalConfigHandler.updateBoardConfig('host', {
            rootDir: this.boardEnv.hostRootDir,
            shellFile: this.boardEnv.shellFile,
            toolchain: {
                gcc: 'gcc',
                ar: 'ar',
                make: 'mingw32-make'
            },
        })
    }

    private async verifyMingwIsInstalledStep() {
        if (await isPackageInstalledOnWindows('gcc')) {
            if (!(await this.isMingwGccAvailable())) {
                throw new Error("gcc is not a MinGW compiler. Please install MinGW-w64 and add it to PATH.");
            }
        } else {
            throw new Error("Cannot find gcc command. Please install MinGW-w64 and add it to PATH.");
        }
    }

    private async isMingwGccAvailable(): Promise<boolean> {
        const machine = await this.getGccTargetMachine();
        console.log(machine)
        return machine?.includes('mingw') ?? false;
    }

    private async getGccTargetMachine(): Promise<string | undefined> {
        try {
            return (await exec('gcc -dumpmachine', { silent: true })).trim();
        } catch {
            return undefined;
        }
    }

    private async buildHostRuntimeStep() {
        await this.boardEnv.buildHostRuntime();
    }
}