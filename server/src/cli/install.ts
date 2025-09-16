import { logger, executeCommand } from "./utils";
import * as fs from 'fs';
import { GLOBAL_PATH, PACKAGE_PATH } from "./path";

export default function installPackage(packageName: string) {
    logger.error(`Installing ${packageName}...`);
    try {
        const srcDir = PACKAGE_PATH.SUB_PACKAGE_DIR(GLOBAL_PATH.PACKAGES_DIR(), packageName);
        if (!fs.existsSync(srcDir)) {
            throw new Error(`Cannot find ${packageName}`);
        }
        const distDir = PACKAGE_PATH.LOCAL_PACKAGES_DIR('./');
        executeCommand(`cp -r ${srcDir} ${distDir}`);
        logger.success(`Successfully installed ${packageName}`);
    } catch (error) {
        logger.error(`Failed to install ${packageName}.: ${error}`);
        process.exit(1);
    }
}
