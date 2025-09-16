import { ESP_IDF_PATH, GLOBAL_PATH } from "./path";
import { logger } from "./utils";
import * as fs from 'fs';


export default async function remove(device: string) {
    try {
        switch (device) {
            case 'esp32':
                removeESP32();
                break;
            case 'host':
                logger.warn('Not impelented yet.');
                break;
            case 'all':
                removeAll();
                break;
            default:
                logger.warn('Unknown device.');
                break;
        }
    } catch (error) {
        logger.error('Failed to remove the setup.');
        process.exit(1);
    }
}


function removeESP32() {
    removeDeviceSetup(ESP_IDF_PATH.ROOT());
}

function removeAll() {
    removeDeviceSetup(GLOBAL_PATH.BSCRIPT_DIR());
}

function removeDeviceSetup(dirPath: string) {
    if (fs.existsSync(dirPath)) {
        logger.info(`Deleting ${dirPath}.`);
        fs.rmSync(dirPath, { recursive: true, force: true });
        logger.success(`Successfully delte ${dirPath}.`);
    } else {
        logger.info(`${dirPath} does not exit.`);
        throw new Error();
    }
}