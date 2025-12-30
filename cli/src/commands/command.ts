import { GlobalConfigHandler } from "../config/global-config";
import packageJson from '../../package.json';
import { logger } from "../core/logger";
import chalk from "chalk";


export abstract class CommandHandler {
    protected globalConfigHandler: GlobalConfigHandler;

    constructor(checkUpdate = true) {
        this.globalConfigHandler = GlobalConfigHandler.load();
        if (checkUpdate) {
            this.checkUpdate();
        }
    }

    private checkUpdate() {
        const cliVersion = packageJson.version;
        const envVersion = this.globalConfigHandler.getConfig().version;
        console.log("foo")
        if (cliVersion !== envVersion) {
            logger.warn('The version of the board environment does not match the CLI version.');
            logger.warn(`Please run ${chalk.yellow(`bscript board update`)}`);
            process.exit(1);
        }
    }
}
