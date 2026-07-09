import * as path from 'path';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from '../../config/constants';
import { simpleExec } from '../../core/command-exec';


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
    abstract isPackageInstalled(name: string): Promise<boolean>;
    
    isPythonVersionGreaterThan3(): Promise<boolean> {
        return isPythonVersionGreaterThan3();
    };

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
    async isPackageInstalled(name: string): Promise<boolean> {
        return false;
    }
    async isPythonVersionGreaterThan3(): Promise<boolean> {
        return false;
    }
}

export async function isPackageInstalledOnUnix(name: string) {
    try {
        await simpleExec('which', [name]);
        return true;
    } catch {
        return false;
    }
}

export async function isPackageInstalledOnWindows(name: string) {
    try {
        await simpleExec('where.exe', [name]);
        return true;
    } catch {
        return false;
    }
}

export async function isPythonVersionGreaterThan3() {
    try {
        const result = await simpleExec(
            'python',
            ['-c', 'import sys; print(sys.version_info.major)'],
        );
        return result.trim() === '3';
    } catch {
        return false;
    }
}

