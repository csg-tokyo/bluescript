import { Command } from "commander";
import { logger, runStep, skip } from "../../core/logger";
import { CommandHandler } from "../command";
import { GLOBAL_SETTINGS } from "../../config/constants";
import * as fs from '../../core/fs';
import * as path from 'path';
import { buildHostRuntime } from "../../platforms/runtime/host-board-runtime";
import { BaseBoardEnv, createBoardEnv, Esp32Env } from "../../platforms/board-env";


class UpdateHandler extends CommandHandler {
    private existingRuntimeDir: string | undefined;
    private existingEspDir: string | undefined;
    private existingHostDir: string | undefined;
    private tmpRuntimeDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'tmp-runtime');
    private tmpEspDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'tmp-esp');
    private tmpHostDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'tmp-host');

    constructor() {
        super(false);
    }

    async update() {
        try {
            await this.updateRuntimeStep();
            await this.updateEsp32Step();
            await this.updateHostStep();
            this.globalConfigHandler.setVersion(GLOBAL_SETTINGS.VM_VERSION);
        } catch (error) {
            // Restore
            if (this.existingRuntimeDir) {
                fs.moveDir(this.tmpRuntimeDir, this.existingRuntimeDir);
            }
            if (this.existingEspDir) {
                fs.moveDir(this.tmpEspDir, this.existingEspDir);
            }
            if (this.existingHostDir) {
                fs.moveDir(this.tmpHostDir, this.existingHostDir);
            }
            throw error;
        } finally {
            if (fs.exists(this.tmpRuntimeDir)) {
                fs.removeDir(this.tmpRuntimeDir);
            }
            if (fs.exists(this.tmpEspDir)) {
                fs.removeDir(this.tmpEspDir);
            }
            this.globalConfigHandler.save();
        }
    }

    private updateRuntimeStep() {
        return runStep('Updating Runtime...', async () => {
            const globalConfig = this.globalConfigHandler.getConfig();
            if (globalConfig.runtimeDir === undefined || globalConfig.version === GLOBAL_SETTINGS.VM_VERSION) {
                return skip('not needed');
            }
            await this.updateRuntime();
        });
    }

    private updateEsp32Step() {
        return runStep('Updating the environment for esp32...', async () => {
            if (this.globalConfigHandler.isBoardSetup('esp32')) {
                return skip('not setup');
            }
            const esp32Config = this.globalConfigHandler.getBoardConfig('esp32')!;
            const esp32Env = createBoardEnv('esp32');
            if (esp32Config.idfVersion === esp32Env.idfVersion) {
                return skip('not needed');
            }
            await this.updateEsp32(esp32Env);
        });
    }

    private updateHostStep() {
        return runStep('Updating the environment for host...', async () => {
            const globalConfig = this.globalConfigHandler.getConfig();
            if (globalConfig.runtimeDir === undefined || globalConfig.version === GLOBAL_SETTINGS.VM_VERSION) {
                return skip('not needed');
            }
            await this.updateHost();
        });
    }

    private async updateRuntime() {
        const env = new BaseBoardEnv();
        this.existingRuntimeDir = env.runtimeDir;
        fs.moveDir(env.runtimeDir, this.tmpRuntimeDir);
        
        env.downloadBlueScriptRuntime();
        this.globalConfigHandler.setRuntimeDir(env.runtimeDir);
    }

    private async updateHost() {
        const hostEnv = createBoardEnv('host');
        await hostEnv.buildHostRuntime();
    }

    private async updateEsp32(esp32Env: Esp32Env) {
        this.existingEspDir = esp32Env.espRootDir;
        fs.moveDir(esp32Env.espRootDir, this.tmpEspDir);
        esp32Env.refreshBoardRoot();

        await esp32Env.cloneEspIdf();
        await esp32Env.runEspIdfInstallScript();
        this.globalConfigHandler.updateBoardConfig('esp32', {
            idfVersion: esp32Env.idfVersion,
            rootDir: esp32Env.espRootDir,
            xtensaGccDir: await esp32Env.getXtensaGccDir(),
        });
    }
}

export async function handleUpdateCommand() {
    try {
        const updateHandler = new UpdateHandler();
        await updateHandler.update();

        logger.br();
        logger.success(`Success to update board environments.`);

    } catch (error) {
        logger.error(`Failed to update board environments.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerUpdateCommand(program: Command) {
    program
        .command('update')
        .description('update the board environments.')
        .action(handleUpdateCommand);
}
