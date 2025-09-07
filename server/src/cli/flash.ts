import { BSCRIPT_RUNTIME_DIR, ESP_DIR } from "./constants";
import { logger, getHostOSType, executeCommand } from "./utils";

export default async function flash(device: string, port: string) {
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
}

async function flashESP32(port: string) {
    const osType = getHostOSType();
    try {
        if (osType === 'macos') {
            const exportPath = `${ESP_DIR}/esp-idf/export.sh`;
            const cwd = `${BSCRIPT_RUNTIME_DIR}/ports/esp32`
            await executeCommand(`source ${exportPath} && idf.py build flash -p ${port}`, cwd);
        } else {
            logger.warn("Not implemented yet.");
            return;
        }
    } catch (error) {
        logger.error('Failed to flash to esp32.');
        process.exit(1);
    }
}