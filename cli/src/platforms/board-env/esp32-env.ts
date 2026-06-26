import * as path from 'path';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from "../../config/constants";
import { exec } from '../../core/shell';
import { BaseBoardEnv } from "./base-env";


const ESP_ROOT_DIR = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'esp');
const IDF_GIT_REPO = 'https://github.com/espressif/esp-idf.git';
const IDF_VERSION = 'v5.4';
const IDF_DIR = path.join(ESP_ROOT_DIR, 'esp-idf');
const IDF_EXPORT_SH_FILE = path.join(IDF_DIR, 'export.sh');
const IDF_INSTALL_SH_FILE = path.join(IDF_DIR, 'install.sh');
const IDF_TOOLS_PY_FILE = path.join(IDF_DIR, 'tools/idf_tools.py');
const XTENSA_DIR_NAME = 'xtensa-esp-elf/';
const XTENSA_GCC_NAME = 'xtensa-esp32-elf-gcc';


export abstract class Esp32Env extends BaseBoardEnv {
    get espRootDir() { return ESP_ROOT_DIR; }
    get idfVersion() { return IDF_VERSION; }
    get idfGitRepo() { return IDF_GIT_REPO; }
    abstract get idfExportFile(): string;

    async cloneEspIdf() {
        await exec(
            `git clone --depth 1 -b ${IDF_VERSION} --recursive ${IDF_GIT_REPO}`, 
            { cwd: ESP_ROOT_DIR }
        );
    }

    removeBoardRoot() {
        if (fs.exists(ESP_ROOT_DIR)) {
            fs.removeDir(ESP_ROOT_DIR);
        }
    }

    refreshBoardRoot() {
        this.removeBoardRoot();
        fs.makeDir(ESP_ROOT_DIR);
    }

    abstract runEspIdfInstallScript(): Promise<void>;
    abstract getXtensaGccDir(): Promise<string>;

    protected parseKeyValueExport(stdout: string): Map<string, string> {
        const env = new Map<string, string>();

        for (const line of stdout.trim().split('\n')) {
            if (!line || line.startsWith('ERROR:') || line.startsWith('WARNING:')) {
            continue;
            }
            const eq = line.indexOf('=');
            if (eq === -1) continue;

            const key = line.slice(0, eq);
            const value = line.slice(eq + 1);
            env.set(key, value);
        }

        return env;
    }

    protected splitPathValue(pathValue: string, separator: string): string[] {
        return pathValue
            .split(separator)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
    }

    protected resolveXtensaGccDirFromExport(stdout: string, pathLabel: string, pathSeparator: string): string {
        const env = this.parseKeyValueExport(stdout);

        const pathValue = env.get(pathLabel);
        if (!pathValue) {
            throw new Error('PATH not found in idf_tools.py export output');
        }

        return this.findXtensaGccDirFromPathEntries(this.splitPathValue(pathValue, pathSeparator));
    }

    protected findXtensaGccDirFromPathEntries(entries: string[]): string {
        const xtensaDirPattern = new RegExp(XTENSA_DIR_NAME);
        for (const entry of entries) {
            if (xtensaDirPattern.test(entry) && fs.exists(path.join(entry, XTENSA_GCC_NAME))) {
                return entry;
            }
        }

        throw new Error(`${XTENSA_DIR_NAME} not found in exported PATH`);
    }
}

export class Esp32DarwinEnv extends Esp32Env {
    get idfExportFile() { return IDF_EXPORT_SH_FILE; }

    async runEspIdfInstallScript() {
        await exec(IDF_INSTALL_SH_FILE);
    }

    async getXtensaGccDir() {
        try {
            const stdout = await exec(`${IDF_TOOLS_PY_FILE} export --format key-value`);
            return super.resolveXtensaGccDirFromExport(stdout, 'PATH', ':');
        } catch (error) {
            throw new Error(`Failed to find ${XTENSA_DIR_NAME}.`, { cause: error });
        }
    }
}