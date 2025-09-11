import { logger, directoryExists, deleteDirectory } from "./utils";
import { BSCRIPT_DIR, ESP_DIR } from "./constants";
import { ca } from "zod/v4/locales/index.cjs";

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
    removeDeviceSetup(ESP_DIR);
}

function removeAll() {
    removeDeviceSetup(BSCRIPT_DIR);
}

function removeDeviceSetup(dirPath: string) {
    if (directoryExists(dirPath)) {
        logger.info(`Deleting ${dirPath}.`);
        deleteDirectory(dirPath);
        logger.success(`Successfully delte ${dirPath}.`);
    } else {
        logger.info(`${dirPath} does not exit.`);
        throw new Error();
    }
}