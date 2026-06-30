import * as path from 'path';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from '../../config/constants';


export abstract class BoardEnv {
    get runtimeDir() {
        return path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'microcontroller');
    }

    get runtimeZipUrl() {
        const v = GLOBAL_SETTINGS.VM_VERSION;
        return `https://github.com/csg-tokyo/bluescript/releases/download/v${v}/release-microcontroller-v${v}.zip`;
    }

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

    abstract removeBoardRoot():  void;

    abstract refreshBoardRoot(): void;

    async downloadBlueScriptRuntime() {
        if (fs.exists(this.runtimeDir)) {
            fs.removeDir(this.runtimeDir);
        }
        await fs.downloadAndUnzip(this.runtimeZipUrl, GLOBAL_SETTINGS.BLUESCRIPT_DIR);
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

export class CommonBoardEnv extends BoardEnv {
    removeBoardRoot(): void {}
    refreshBoardRoot(): void {}
}
