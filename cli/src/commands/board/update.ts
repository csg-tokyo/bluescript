import { Command } from "commander";
import { logger, runStep, skip } from "../../core/logger";
import { CommandHandler } from "../command";
import { GLOBAL_SETTINGS } from "../../config/constants";
import * as fs from '../../core/fs';
import * as path from 'path';
import { CommonBoardEnv, createBoardEnv, Esp32Env } from "../../platforms/board-env";
import { Esp32BoardConfig, GlobalConfig, GlobalConfigHandler } from "../../config/global-config";
import chalk from "chalk";


class UpdateHandler extends CommandHandler {
    private oldGlobalConfig?: GlobalConfig;
    private globalConfigHandler: GlobalConfigHandler;
    private existingRuntimeDir: string | undefined;
    private existingEspDir: string | undefined;
    private tmpRuntimeDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'tmp-runtime');
    private tmpEspDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'tmp-esp');

    constructor() {
        super();
        const { handler, oldConfig } = this.getOldGlobalConfigAndHandler();
        this.oldGlobalConfig = oldConfig;
        this.globalConfigHandler = handler;
    }

    private getOldGlobalConfigAndHandler() {
        if (!GlobalConfigHandler.isGlobalConfigFileExists()) {
            logger.warn("The BlueScript environment is not setup.");
            process.exit(1);
        }
        try {
            const handler = GlobalConfigHandler.load();
            const oldConfig = structuredClone(handler.getConfig());
            if (oldConfig.version === GLOBAL_SETTINGS.VM_VERSION) {
                logger.warn("Update is not needed.");
                process.exit(0);
            }
            return { handler, oldConfig };
        } catch (error) {
            const handler = GlobalConfigHandler.loadEmpty();
            const oldConfig = GlobalConfigHandler.getConfigWithoutCheck();
            return { handler, oldConfig };
        }
    }

    async update() {
        try {
            await this.updateRuntimeStep();
            await this.updateEsp32Step();
            await this.updateHostStep();
            this.globalConfigHandler.setVersion(GLOBAL_SETTINGS.VM_VERSION);
            this.globalConfigHandler.save();
        } catch (error) {
            // Restore
            if (this.existingRuntimeDir && fs.exists(this.tmpRuntimeDir)) {
                fs.moveDir(this.tmpRuntimeDir, this.existingRuntimeDir);
            }
            if (this.existingEspDir && fs.exists(this.tmpEspDir)) {
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
    }

    private updateRuntimeStep() {
        return runStep('Updating Runtime...', async () => {
            if (this.oldGlobalConfig?.runtimeDir === undefined) {
                return skip('not needed');
            }
            await this.updateRuntime();
        });
    }

    private updateEsp32Step() {
        return runStep('Updating the environment for esp32...', async () => {
            if (!("esp32" in (this.oldGlobalConfig?.boards ?? {}))) {
                return skip('not setup');
            }
            const esp32Config = this.oldGlobalConfig?.boards.esp32;
            const esp32Env = createBoardEnv('esp32');
            await this.updateEsp32(esp32Env, esp32Config);
        });
    }

    private updateHostStep() {
        return runStep('Updating the environment for host...', async () => {
            if (!("host" in (this.oldGlobalConfig?.boards ?? {}))) {
                return skip('not setup');
            }
            await this.updateHost();
        });
    }

    private async updateRuntime() {
        const env = new CommonBoardEnv();
        this.existingRuntimeDir = env.runtimeDir;
        fs.moveDir(env.runtimeDir, this.tmpRuntimeDir);
        
        await env.downloadBlueScriptRuntime();
        this.globalConfigHandler.setRuntimeDir(env.runtimeDir);
    }

    private async updateHost() {
        const hostEnv = createBoardEnv('host');
        await hostEnv.buildHostRuntime();
        const boardConfig = this.oldGlobalConfig?.boards.host;
        let gccCommand = boardConfig?.toolchain.gcc ?? await hostEnv.getGccCommand();
        let arCommand = boardConfig?.toolchain.ar ?? await hostEnv.getArCommand();
        let makeCommand = boardConfig?.toolchain.make ??await hostEnv.getMakeCommand();
        this.globalConfigHandler.setBoardConfig('host', {
            rootDir: hostEnv.hostRootDir,
            shellFile: hostEnv.shellFile,
            toolchain: {
                gcc: gccCommand,
                ar: arCommand,
                make: makeCommand,
            },
        });
    }

    private async updateEsp32(esp32Env: Esp32Env, boardConfig?: Esp32BoardConfig) {
        this.existingEspDir = esp32Env.espRootDir;

        if (boardConfig?.idfVersion !== esp32Env.idfVersion) {
            fs.moveDir(esp32Env.espRootDir, this.tmpEspDir);
            esp32Env.refreshBoardRoot();
            await esp32Env.cloneEspIdf();
            await esp32Env.runEspIdfInstallScript();
        }
        let pythonCommand = boardConfig?.toolchain.python ?? await esp32Env.getPythonCommand();
        let makeCommand = boardConfig?.toolchain.make ?? await esp32Env.getMakeCommand();
        const xtensaGccDir = await esp32Env.getXtensaGccDir(pythonCommand);
        this.globalConfigHandler.setBoardConfig('esp32', {
            idfVersion: esp32Env.idfVersion,
            rootDir: esp32Env.espRootDir,
            exportFile: esp32Env.idfExportFile,
            toolchain: {
                gcc: path.join(xtensaGccDir, esp32Env.xtensaGccFileName),
                ar: path.join(xtensaGccDir, esp32Env.xtensaArFileName),
                ld: path.join(xtensaGccDir, esp32Env.xtensaLdFileName),
                make: makeCommand,
                python: pythonCommand
            },
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

        logger.info(`If you cannot update, run ${chalk.yellow('bscript board fullclean')} and setup boards from the beginning.`);
        process.exit(1);
    }
}

export function registerUpdateCommand(program: Command) {
    program
        .command('update')
        .description('update the board environments.')
        .action(handleUpdateCommand);
}
