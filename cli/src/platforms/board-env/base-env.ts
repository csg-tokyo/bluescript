import * as path from 'path';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from "../../config/constants";


const RUNTIME_ZIP_URL = `https://github.com/csg-tokyo/bluescript/releases/download/v${GLOBAL_SETTINGS.VM_VERSION}/release-microcontroller-v${GLOBAL_SETTINGS.VM_VERSION}.zip`;
const RUNTIME_DIR = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'microcontroller');
    
export class BaseBoardEnv {
    get runtimeZipUrl() { return RUNTIME_ZIP_URL; }
    get runtimeDir() { return RUNTIME_DIR; }

    ensureBlueScriptDir() {
        if (!fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_DIR)) {
            fs.makeDir(GLOBAL_SETTINGS.BLUESCRIPT_DIR);
        }
    }

    removeBlueScriptDir() {
        if (fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_DIR)) {
            fs.removeDir(GLOBAL_SETTINGS.BLUESCRIPT_DIR);
        }
    }

    removeBoardRoot() {}

    refreshBoardRoot() {}

    async downloadBlueScriptRuntime() {
        if (fs.exists(RUNTIME_DIR)) {
            fs.removeDir(RUNTIME_DIR);
        }
        await fs.downloadAndUnzip(RUNTIME_ZIP_URL, GLOBAL_SETTINGS.BLUESCRIPT_DIR);
    }

    needUpdate(): boolean {
        if (!fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE)) {
            return false;
        }
        const currentVersion = GLOBAL_SETTINGS.VM_VERSION;
        const configFile = JSON.parse(fs.readFile(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE));
        const existingVersion = configFile.version;
        return currentVersion !== existingVersion;
    }
}