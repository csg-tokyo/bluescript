import { runStep, skip } from "../../../core/logger";
import { StepSkip } from "../../../core/logger/step-runner";
import { CommandHandler } from "../../command";
import { BoardName } from "../../../config/board-utils";
import { BaseBoardEnv } from "../../../platforms/board-env/base-env";


export interface Step {
    description: string;
    actionMessage: string;
    action: () => Promise<void|StepSkip>;
}


export abstract class SetupHandler extends  CommandHandler {
    abstract boardName: BoardName;
    abstract boardEnv: BaseBoardEnv;
    protected setupSteps: Step[] = [];
    
    constructor() {
        super();
        this.loadSetupSteps();
    }

    protected loadSetupSteps() {
        this.setupSteps.push({
            description: `Download BlueScript runtime from ${this.boardEnv.runtimeZipUrl}.`,
            actionMessage: `Downloading BlueScript runtime from ${this.boardEnv.runtimeZipUrl}...`,
            action: this.downloadBlueScriptRuntimeStep.bind(this)
        });
    }

    needSetup() {
        return !this.globalConfigHandler.isBoardSetup(this.boardName);
    }

    async setup() {
        this.boardEnv.ensureBlueScriptDir();
        this.boardEnv.refreshBoardRoot();
        for (const step of this.setupSteps) {
            runStep(step.actionMessage, step.action);
        }
        this.globalConfigHandler.save();
    };
    
    getSetupPlan(): string[] {
        return this.setupSteps.map(step => step.description);
    };

    protected async downloadBlueScriptRuntimeStep() {
        if (this.globalConfigHandler.isRuntimeSetup()) {
            return skip('already downloaded.');
        }
        
        this.boardEnv.downloadBlueScriptRuntime();
        this.globalConfigHandler.setRuntimeDir(this.boardEnv.runtimeDir);
    }
}
