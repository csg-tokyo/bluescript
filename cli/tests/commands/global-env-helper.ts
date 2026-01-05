import * as path from "path";
import * as fs from '../../src/core/fs';
import { GLOBAL_SETTINGS } from "../../src/config/constants";


// export const DUMMY_BLUESCRIPT_DIR = path.join(TEMP_DIR, '.bluescript');
// export const DUMMY_BLUESCRIPT_CONFIG_FILE = path.join(DUMMY_BLUESCRIPT_DIR, 'config.json');
// const DUMMY_RUNTIME_DIR = path.join(DUMMY_BLUESCRIPT_DIR, 'microcontroller');

const TEMP_DIR = path.join(__dirname, '../../temp-files');
const DUMMY_BLUESCRIPT_DIR = (suffix: string) => path.join(TEMP_DIR, `.bluescript-${suffix}`);
export const DUMMY_VM_VERSION = '0.0.1';
export const DUMMY_OLD_VM_VERSION = '0.0.0';

export const DUMMY_ESP_IDF_VERSION = 'v5.4';
export const DUMMY_OLD_ESP_IDF_VERSION = 'v5.3';


export function spyGlobalSettings(globalDirSuffix: string) {
    jest.spyOn(GLOBAL_SETTINGS, 'BLUESCRIPT_DIR', 'get').mockReturnValue(DUMMY_BLUESCRIPT_DIR(globalDirSuffix));
    jest.spyOn(GLOBAL_SETTINGS, 'VM_VERSION', 'get').mockReturnValue(DUMMY_VM_VERSION);
    jest.spyOn(GLOBAL_SETTINGS, 'ESP_IDF_VERSION', 'get').mockReturnValue(DUMMY_ESP_IDF_VERSION);
}

export function setupEmpyGlobalEnv() {
    if (!GLOBAL_SETTINGS.BLUESCRIPT_DIR.startsWith(TEMP_DIR)) {
        throw new Error('Global settings is not mocked');
    }
    fs.makeDir(GLOBAL_SETTINGS.BLUESCRIPT_DIR, true);
}

export function setupGlobalEnv(config: object) {
    setupEmpyGlobalEnv();
    const data = JSON.stringify(config, null, 2);
    fs.writeFile(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE, data);
}

export function deleteGlobalEnv() {
    if (!GLOBAL_SETTINGS.BLUESCRIPT_DIR.startsWith(TEMP_DIR)) {
        throw new Error('Global settings is not mocked');
    }
    if (fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_DIR)) {
        fs.removeDir(GLOBAL_SETTINGS.BLUESCRIPT_DIR);
    }
}

export function setupDefaultGlobalEnv(isOldVersion = false) {
    setupGlobalEnv({
        version:  isOldVersion ? DUMMY_OLD_VM_VERSION : DUMMY_VM_VERSION,
        runtimeDir: GLOBAL_SETTINGS.RUNTIME_DIR,
        boards: {}
    });
    fs.makeDir(GLOBAL_SETTINGS.RUNTIME_DIR);
}

export function setupGlobalEnvWithEsp32(isOldVersion = false, isEspIdfOldVersion = false) {
    setupGlobalEnv({
        version:  isOldVersion ? DUMMY_OLD_VM_VERSION : DUMMY_VM_VERSION,
        runtimeDir: GLOBAL_SETTINGS.RUNTIME_DIR,
        boards: {
            esp32: {
                idfVersion: isEspIdfOldVersion ? DUMMY_OLD_ESP_IDF_VERSION : DUMMY_ESP_IDF_VERSION,
                rootDir: GLOBAL_SETTINGS.ESP_ROOT_DIR,
                exportFile: GLOBAL_SETTINGS.ESP_IDF_EXPORT_FILE,
                xtensaGccDir: "/.espressif/tools/xtensa-esp-elf/esp-14.2.0_20241119/xtensa-esp-elf/bin"
            }
        }
    });
    fs.makeDir(GLOBAL_SETTINGS.ESP_ROOT_DIR);
    fs.makeDir(GLOBAL_SETTINGS.RUNTIME_DIR);
}

export function getGlobalConfig(): any {
    if (!fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE)) {
         throw new Error("Cannot find config file.");
    }
    return JSON.parse(fs.readFile(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE));
}

