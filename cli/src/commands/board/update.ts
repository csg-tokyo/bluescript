import { Command } from "commander";
import { logger, LogStep, showErrorMessages, SkipStep } from "../../core/logger";
import { CommandHandler } from "../command";
import { GLOBAL_SETTINGS } from "../../config/constants";
import * as fs from '../../core/fs';
import { exec } from "../../core/shell";
import * as path from 'path';


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
            await this.updateRuntime();
            if (this.globalConfigHandler.isBoardSetup('esp32')) {
                await this.updateEsp32();
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

    @LogStep('Updating Runtime...')
    async updateRuntime() {
        const globalConfig = this.globalConfigHandler.getConfig();
        if (globalConfig.runtimeDir === undefined || globalConfig.version === GLOBAL_SETTINGS.VM_VERSION) {
            throw new SkipStep('not needed', undefined);
        }
        this.existingRuntimeDir = globalConfig.runtimeDir;
        
        fs.moveDir(this.existingRuntimeDir, this.tmpRuntimeDir);
        await fs.downloadAndUnzip(GLOBAL_SETTINGS.RUNTIME_ZIP_URL, GLOBAL_SETTINGS.BLUESCRIPT_DIR);
        this.globalConfigHandler.setRuntimeDir(GLOBAL_SETTINGS.RUNTIME_DIR);
    }

    @LogStep('Updating the environment for esp32...')
    async updateEsp32() {
        const esp32Config = this.globalConfigHandler.getBoardConfig('esp32')!;
        if (esp32Config.idfVersion === GLOBAL_SETTINGS.ESP_IDF_VERSION) {
            throw new SkipStep('not needed', undefined);
        }
        this.existingEspDir = esp32Config.rootDir;

        fs.moveDir(this.existingEspDir, this.tmpEspDir);
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
        showErrorMessages(error);
        process.exit(1);
    }
}

export function registerUpdateCommand(program: Command) {
    program
        .command('update')
        .description('update the board environments.')
        .action(handleUpdateCommand);
}