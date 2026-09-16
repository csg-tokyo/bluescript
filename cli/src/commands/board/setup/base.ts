import { runStep, skip } from "../../../core/logger";
import { StepSkip } from "../../../core/logger/step-runner";
import { CommandHandlerWithUpdateCheck } from "../../command";
import { BoardName } from "../../../config/board-utils";
import { CommonBoardEnv } from "../../../platforms/board-env/common-env";


export interface Step {
    description: string;
    actionMessage: string;
    action: () => Promise<void|StepSkip>;
}


export abstract class SetupHandler extends  CommandHandlerWithUpdateCheck {
    abstract boardName: BoardName;
    abstract boardEnv: CommonBoardEnv;
    protected setupSteps: Step[] = [];
    
    constructor() {
        super();
    }

    loadSetupSteps() {
        this.setupSteps.push({
            description: `Download BlueScript runtime from ${this.boardEnv.runtimeZipUrl}.`,
            actionMessage: `Downloading BlueScript runtime...`,
            action: this.downloadBlueScriptRuntimeStep.bind(this)
        });
        this.loadBoardSetupSteps();
    }

    needSetup() {
        return !this.globalConfigHandler.isBoardSetup(this.boardName);
    }

    async setup() {
        this.boardEnv.ensureBlueScriptDir();
        this.prepareBoardRoot();
        for (const step of this.setupSteps) {
            await runStep(step.actionMessage, step.action);
        }
        await this.setBoardConfig();
        this.globalConfigHandler.save();
    };
    
    getSetupPlan(): string[] {
        return this.setupSteps.map(step => step.description);
    };

    // Prepare the directory for the board environment. By default the directory is recreated.
    protected prepareBoardRoot() {
        this.boardEnv.refreshBoardRoot();
    }

    abstract loadBoardSetupSteps(): void;
    abstract setBoardConfig(): Promise<void>;

    protected async downloadBlueScriptRuntimeStep() {
        if (this.globalConfigHandler.isRuntimeSetup()) {
            return skip('already downloaded.');
        }
        
        await this.boardEnv.downloadBlueScriptRuntime();
        this.globalConfigHandler.setRuntimeDir(this.boardEnv.runtimeDir);
    }
}
