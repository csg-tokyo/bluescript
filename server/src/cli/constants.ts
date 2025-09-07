import * as path from 'path';
import * as os from 'os';


export const BSCRIPT_DIR = expandTilde('~/bscript');
export const ESP32_DIR = `${BSCRIPT_DIR}/esp`;
export const BSCRIPT_FIRMWARE_DIR = `${BSCRIPT_DIR}/microcontroller`;
export const BSCRIPT_MODULES_DIR = `${BSCRIPT_DIR}/modules`;
export const BSCRIPT_FIRMWARE_ZIP_URL = 'https://github.com/csg-tokyo/bluescript/releases/download/v1.1.4/release-microcontroller-v1.1.4.zip';
export const BSCRIPT_MODULES_ZIP_URL = 'https://github.com/csg-tokyo/bluescript/releases/download/v1.1.4/release-modules-v1.1.4.zip';

export const BSCRIPT_CONFIG_FILE_NAME = 'bsconfig.json';
export const BSCRIPT_ENTRY_FILE_NAME = 'index.bs';
export const BSCRIPT_BUILD_DIR = 'build';

export const BLE_SERVICE_UUID = '00ff';
export const BLE_CHARACTERISTIC_UUID = 'ff01';

function expandTilde(targetPath: string) {
    return targetPath.startsWith('~') ? path.join(os.homedir(), targetPath.slice(1)) : targetPath;
}
