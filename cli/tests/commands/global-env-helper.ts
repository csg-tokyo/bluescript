import * as path from "path";
import * as fs from '../../src/core/fs';
import { GLOBAL_SETTINGS } from "../../src/config/constants";
import { CommonBoardEnv, Esp32DarwinEnv } from "../../src/platforms/board-env";

const TEMP_DIR = path.join(__dirname, '../../temp-files');
const DUMMY_BLUESCRIPT_DIR = (suffix: string) => path.join(TEMP_DIR, `.bluescript-${suffix}`);
export const DUMMY_VM_VERSION = '0.0.1';
export const DUMMY_OLD_VM_VERSION = '0.0.0';

export const DUMMY_ESP_IDF_VERSION = 'v5.4';
export const DUMMY_OLD_ESP_IDF_VERSION = 'v5.3';

function commonBoardEnv() { return new CommonBoardEnv(); }
function esp32BoardEnv() { return new Esp32DarwinEnv(); }
export function getTestRuntimeDir() { return commonBoardEnv().runtimeDir; }
export function getTestEspRootDir() { return esp32BoardEnv().espRootDir; }
export function getTestEspIdfExportFile() { return esp32BoardEnv().idfExportFile; }

export function spyGlobalSettings(globalDirSuffix: string) {
    jest.spyOn(GLOBAL_SETTINGS, 'BLUESCRIPT_DIR', 'get').mockReturnValue(DUMMY_BLUESCRIPT_DIR(globalDirSuffix));
    jest.spyOn(GLOBAL_SETTINGS, 'VM_VERSION', 'get').mockReturnValue(DUMMY_VM_VERSION);
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
        runtimeDir: getTestRuntimeDir(),
        boards: {}
    });
    fs.makeDir(getTestRuntimeDir());
}

export function setupGlobalEnvWithHost(isOldVersion = false, buildDir?: string) {
    const resolvedBuildDir = buildDir ?? path.join(getTestRuntimeDir(), 'ports/host/build');
    setupGlobalEnv({
        version: isOldVersion ? DUMMY_OLD_VM_VERSION : DUMMY_VM_VERSION,
        runtimeDir: getTestRuntimeDir(),
        boards: {
            host: {
                buildDir: resolvedBuildDir,
            },
        },
    });
    fs.makeDir(resolvedBuildDir);
    fs.makeDir(getTestRuntimeDir());
}

export function setupGlobalEnvWithHostIntegration(runtimeDir: string, buildDir: string) {
    setupGlobalEnv({
        version: DUMMY_VM_VERSION,
        runtimeDir,
        boards: {
            host: {
                buildDir,
            },
        },
    });
}

export function setupGlobalEnvWithEsp32(isOldVersion = false, isEspIdfOldVersion = false) {
    setupGlobalEnv({
        version:  isOldVersion ? DUMMY_OLD_VM_VERSION : DUMMY_VM_VERSION,
        runtimeDir: getTestRuntimeDir(),
        boards: {
            esp32: {
                idfVersion: isEspIdfOldVersion ? DUMMY_OLD_ESP_IDF_VERSION : DUMMY_ESP_IDF_VERSION,
                rootDir: getTestEspRootDir(),
                exportFile: getTestEspIdfExportFile(),
                xtensaGccDir: "/.espressif/tools/xtensa-esp-elf/esp-14.2.0_20241119/xtensa-esp-elf/bin"
            }
        }
    });
    fs.makeDir(getTestEspRootDir());
    fs.makeDir(getTestRuntimeDir());
}

export function mockXtensaGccFromIdfToolsExport(): string {
    const gccDir = path.join(
        GLOBAL_SETTINGS.BLUESCRIPT_DIR,
        '.espressif/tools/xtensa-esp-elf/bin',
    );
    fs.makeDir(gccDir);
    fs.writeFile(path.join(gccDir, 'xtensa-esp32-elf-gcc'), '');
    return `PATH=${gccDir}:/xtensa-esp-elf-gdb/bin`;
}

export function getGlobalConfig(): any {
    if (!fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE)) {
         throw new Error("Cannot find config file.");
    }
    return JSON.parse(fs.readFile(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE));
}
