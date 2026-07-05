import * as path from 'path';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from "../../config/constants";
import { simpleExec, execShell, execWithLog } from '../../core/command-exec';
import { BoardEnv } from './common-env';

const XTENSA_TOOLCHAIN_DIR = 'xtensa-esp-elf';
const XTENSA_GCC_NAME = 'xtensa-esp32-elf-gcc';
const XTENSA_AR_NAME = 'xtensa-esp32-elf-ar';
const XTENSA_LD_NAME = 'xtensa-esp32-elf-ld';

export abstract class Esp32Env extends BoardEnv {
    get espRootDir() { return path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'esp'); }
    get idfDir() { return path.join(this.espRootDir, 'esp-idf'); }
    get idfToolsPyFile() { return path.join(this.idfDir, 'tools/idf_tools.py'); }
    get idfVersion() { return 'v5.4'; }
    get idfGitRepo() { return 'https://github.com/espressif/esp-idf.git'; }
    abstract get idfExportFile(): string;
    abstract get xtensaGccFileName(): string;
    abstract get xtensaArFileName(): string;
    abstract get xtensaLdFileName(): string;

    abstract runEspIdfInstallScript(): Promise<void>;
    abstract getXtensaGccDir(): Promise<string>;

    async cloneEspIdf() {
        await execWithLog(
            'git',
            ['clone', '--depth', '1', '-b', this.idfVersion, '--recursive', this.idfGitRepo],
            { cwd: this.espRootDir },
        );
    }

    removeBoardRoot() {
        fs.removeDir(this.espRootDir);
    }

    refreshBoardRoot() {
        this.removeBoardRoot();
        fs.makeDir(this.espRootDir);
    }

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
        for (const entry of entries) {
            if (entry.includes(XTENSA_TOOLCHAIN_DIR) && fs.exists(path.join(entry, this.xtensaGccFileName))) {
                return entry;
            }
        }

        throw new Error(`${XTENSA_TOOLCHAIN_DIR} not found in exported PATH`);
    }
}

export class Esp32DarwinEnv extends Esp32Env {
    get idfInstallShFile() { return path.join(this.idfDir, 'install.sh'); }
    get idfExportFile() { return path.join(this.idfDir, 'export.sh'); }
    get xtensaGccFileName() { return XTENSA_GCC_NAME; }
    get xtensaArFileName() { return XTENSA_AR_NAME; }
    get xtensaLdFileName() { return XTENSA_LD_NAME; }

    async runEspIdfInstallScript() {
        await execShell(`bash ${JSON.stringify(this.idfInstallShFile)}`);
    }

    async getXtensaGccDir() {
        try {
            const stdout = await simpleExec(
                'python3',
                [this.idfToolsPyFile, 'export', '--format', 'key-value'],
            );
            return super.resolveXtensaGccDirFromExport(stdout, 'PATH', ':');
        } catch (error) {
            throw new Error(`Failed to find ${XTENSA_TOOLCHAIN_DIR}.`, { cause: error });
        }
    }
}

export class Esp32WindowsEnv extends Esp32Env {
    get idfExportBatFile() { return path.join(this.idfDir, 'export.bat'); }
    get idfInstallBatFile() { return path.join(this.idfDir, 'install.bat'); }
    get idfExportFile() { return this.idfExportBatFile; }
    get xtensaGccFileName(): string { return `${XTENSA_GCC_NAME}.exe`; }
    get xtensaArFileName(): string { return `${XTENSA_AR_NAME}.exe`; }
    get xtensaLdFileName(): string { return `${XTENSA_LD_NAME}.exe`; }

    async runEspIdfInstallScript() {
        await execShell(this.idfInstallBatFile);
    }

    async getXtensaGccDir() {
        try {
            const stdout = await simpleExec(
                'python',
                [this.idfToolsPyFile, 'export', '--format', 'key-value'],
            );
            return super.resolveXtensaGccDirFromExport(stdout, 'PATH', ';');
        } catch (error) {
            throw new Error(`Failed to find ${XTENSA_TOOLCHAIN_DIR}.`, { cause: error });
        }
    }
}
