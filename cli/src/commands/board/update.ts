import { Command } from "commander";
import { logger, runStep, skip } from "../../core/logger";
import { CommandHandler } from "../command";
import { GLOBAL_SETTINGS } from "../../config/constants";
import * as fs from '../../core/fs';
import { exec } from "../../core/shell";
import * as path from 'path';
import { buildHostRuntime } from "../../platforms/runtime/host-board-runtime";


class UpdateHandler extends CommandHandler {
    private existingRuntimeDir: string | undefined;
    private existingEspDir: string | undefined;
    private tmpRuntimeDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'tmp-runtime');
    private tmpEspDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'tmp-esp');

    constructor() {
        super(false);
    }

    async update() {
        try {
            await this.updateRuntimeStep();
            if (this.globalConfigHandler.isBoardSetup('esp32')) {
                await this.updateEsp32Step();
            }
            if (this.globalConfigHandler.isBoardSetup('host')) {
                await this.updateHostStep();
            }
            this.globalConfigHandler.setVersion(GLOBAL_SETTINGS.VM_VERSION);
        } catch (error) {
            // Restore
            if (this.existingRuntimeDir) {
                fs.moveDir(this.tmpRuntimeDir, this.existingRuntimeDir);
            }
            if (this.existingEspDir) {
                fs.moveDir(this.tmpEspDir, this.existingEspDir);
            }
            throw error;
        } finally {
            if (fs.exists(this.tmpRuntimeDir)) {
                fs.removeDir(this.tmpRuntimeDir);
            }
            if (fs.exists(this.tmpEspDir)) {
                fs.removeDir(this.tmpEspDir);
            }
        }
        this.globalConfigHandler.save();
    }

    private updateRuntimeStep() {
        return runStep('Updating Runtime...', async () => {
            const globalConfig = this.globalConfigHandler.getConfig();
            if (globalConfig.runtimeDir === undefined || globalConfig.version === GLOBAL_SETTINGS.VM_VERSION) {
                return skip('not needed');
            }
            this.existingRuntimeDir = globalConfig.runtimeDir;
            await this.updateRuntime(this.existingRuntimeDir);
        });
    }

    private updateEsp32Step() {
        return runStep('Updating the environment for esp32...', async () => {
            const esp32Config = this.globalConfigHandler.getBoardConfig('esp32')!;
            if (esp32Config.idfVersion === GLOBAL_SETTINGS.ESP_IDF_VERSION) {
                return skip('not needed');
            }
            this.existingEspDir = esp32Config.rootDir;
            await this.updateEsp32(this.existingEspDir);
        });
    }

    private updateHostStep() {
        return runStep('Updating the environment for host...', async () => {
            const globalConfig = this.globalConfigHandler.getConfig();
            if (globalConfig.runtimeDir === undefined || globalConfig.version === GLOBAL_SETTINGS.VM_VERSION) {
                return skip('not needed');
            }
            await this.updateHost(globalConfig.runtimeDir);
    });
    }

    private async updateRuntime(existingRuntimeDir: string) {
        fs.moveDir(existingRuntimeDir, this.tmpRuntimeDir);
        await fs.downloadAndUnzip(GLOBAL_SETTINGS.RUNTIME_ZIP_URL, GLOBAL_SETTINGS.BLUESCRIPT_DIR);
        this.globalConfigHandler.setRuntimeDir(GLOBAL_SETTINGS.RUNTIME_DIR);
    }

    private async updateHost(runtimeDir: string) {
        const hostConfig = this.globalConfigHandler.getBoardConfig('host')!;
        await buildHostRuntime(runtimeDir, hostConfig.buildDir);
    }

    private async updateEsp32(existingEspDir: string) {
        fs.moveDir(existingEspDir, this.tmpEspDir);
        fs.makeDir(GLOBAL_SETTINGS.ESP_ROOT_DIR);
        await this.cloneEspIdf();
        await this.runEspIdfInstallScript();
        this.globalConfigHandler.updateBoardConfig('esp32', {
            idfVersion: GLOBAL_SETTINGS.ESP_IDF_VERSION,
            rootDir: GLOBAL_SETTINGS.ESP_ROOT_DIR,
            exportFile: GLOBAL_SETTINGS.ESP_IDF_EXPORT_FILE,
            xtensaGccDir: await this.getXtensaGccDir(),
        });
    }

    private async cloneEspIdf() {
        await exec(`git clone --depth 1 -b ${GLOBAL_SETTINGS.ESP_IDF_VERSION} --recursive ${GLOBAL_SETTINGS.ESP_IDF_GIT_REPO}`,
            { cwd: GLOBAL_SETTINGS.ESP_ROOT_DIR });
    }

    private async runEspIdfInstallScript() {
        await exec(GLOBAL_SETTINGS.ESP_IDF_INSTALL_FILE);
    }

    private async getXtensaGccDir() {
        try {
            const gccPath = await exec(`source ${GLOBAL_SETTINGS.ESP_IDF_EXPORT_FILE} > /dev/null 2>&1 && which xtensa-esp32-elf-gcc`, { silent:true });
            return path.dirname(gccPath);
        } catch (error) {
            throw new Error('Failed to get xtensa gcc path.', {cause: error});
        }
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
