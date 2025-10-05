import { ESP_IDF_PATH, GLOBAL_PATH } from "./path";
import { logger, getHostOSType, executeCommand } from "./utils";

export default async function flash(device: string, port: string) {
    try {
        switch (device) {
            case 'esp32':
                await flashESP32(port);
                break;
            case 'host':
                logger.warn('Not impelented yet.');
                break;
            default:
                logger.warn('Unknown device.');
                break;
        }
    } catch (error) {
        logger.error('Failed to flash the project.');
        process.exit(1);
    }
}

async function flashESP32(port: string) {
    const osType = getHostOSType();
    try {
        if (osType === 'macos') {
            await executeCommand(`source ${ESP_IDF_PATH.EXPORT_FILE()} && idf.py build flash -p ${port}`, GLOBAL_PATH.RUNTIME_ESP_PORT_DIR());
        } else {
            logger.warn("Not implemented yet.");
            return;
        }
    } catch (error) {
        logger.error('Failed to flash to esp32.');
        throw error;
    }
}