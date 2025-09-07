import { logger, directoryExists, deleteDirectory } from "./utils";
import { BSCRIPT_DIR, ESP_DIR } from "./constants";

export default async function remove(device: string) {
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
    }
}