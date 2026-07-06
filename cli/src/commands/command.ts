import { GlobalConfigHandler } from "../config/global-config";
import { logger } from "../core/logger";
import chalk from "chalk";
import { GLOBAL_SETTINGS } from "../config/constants";
import * as fs from '../core/fs';

export abstract class CommandHandler {}

export abstract class CommandHandlerWithUpdateCheck extends CommandHandler {
    protected globalConfigHandler: GlobalConfigHandler;

    constructor() {
        super();
        this.checkUpdate();
        this.globalConfigHandler = GlobalConfigHandler.load();
    }

    private checkUpdate() {
        if (!fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE)) {
            return;
        }
        const currentVersion = GLOBAL_SETTINGS.VM_VERSION;
        const configFile = JSON.parse(fs.readFile(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE));
        const existingVersion = configFile.version;
        if (currentVersion !== existingVersion) {
            logger.warn('The version of the board environment does not match the current CLI version.');
            logger.warn(`Please run ${chalk.yellow(`bscript board update`)}`);
            process.exit(1);
        }
    }
}
