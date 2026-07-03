import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from "child_process";
import { Esp32ToolchainConfig } from "../../src/compiler/board-toolchain/esp32-toolchain";


const XTENSA_TOOLCHAIN_DIR = 'xtensa-esp-elf';
const XTENSA_GCC_NAME = 'xtensa-esp32-elf-gcc';

export const runtimeDir = path.resolve(__dirname, '../../../microcontroller');

export function getEsp32ToolchainConfig(): Esp32ToolchainConfig {
    const osType = os.platform();
    if (osType === 'darwin') {
        const espDir = path.join(os.homedir(), 'esp');
        const idfToolsPy = path.join(espDir, 'esp-idf', 'tools', 'idf_tools.py');
        const stdout = runIdfToolsExport(idfToolsPy);
        const compilerToolchainDir = findXtensaGccDirFromIdfExport(stdout, ':', XTENSA_GCC_NAME);
        return { 
            runtimeDir, 
            compilerToolchain: {
                gcc: path.join(compilerToolchainDir, 'xtensa-esp32-elf-gcc'),
                ar: path.join(compilerToolchainDir, 'xtensa-esp32-elf-ar'),
                ld: path.join(compilerToolchainDir, 'xtensa-esp32-elf-ld'),
                make: 'make'
            }, 
            espDir 
        };
    } else if (osType === 'win32') {
        const espDir = path.join(os.homedir(), 'esp');
        const idfToolsPy = path.join(espDir, 'esp-idf', 'tools', 'idf_tools.py');
        const stdout = runIdfToolsExport(idfToolsPy);
        const compilerToolchainDir = findXtensaGccDirFromIdfExport(
            stdout,
            ';',
            `${XTENSA_GCC_NAME}.exe`,
        );
        return { 
            runtimeDir, 
            compilerToolchain: {
                gcc: path.join(compilerToolchainDir, 'xtensa-esp32-elf-gcc.exe'),
                ar: path.join(compilerToolchainDir, 'xtensa-esp32-elf-ar.exe'),
                ld: path.join(compilerToolchainDir, 'xtensa-esp32-elf-ld.exe'),
                make: 'mingw32-make'
            }, 
            espDir 
        };
    } else {
        throw new Error('Unsupported OS.');
    }
    
}


function findXtensaGccDirFromIdfExport(
    stdout: string,
    pathSeparator: string,
    gccFileName: string,
): string {
    for (const line of stdout.trim().split('\n')) {
        if (!line || line.startsWith('ERROR:') || line.startsWith('WARNING:')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;

        const key = line.slice(0, eq);
        const value = line.slice(eq + 1);
        if (key !== 'PATH') continue;

        for (const entry of value.split(pathSeparator).map((p) => p.trim()).filter(Boolean)) {
            if (entry.includes(XTENSA_TOOLCHAIN_DIR) && fs.existsSync(path.join(entry, gccFileName))) {
                return entry;
            }
        }
    }
    throw new Error(`${XTENSA_TOOLCHAIN_DIR} not found in idf_tools.py export output`);
}

function runIdfToolsExport(idfToolsPy: string): string {
    return execFileSync('python', [idfToolsPy, 'export', '--format', 'key-value'], {
        encoding: 'utf8',
    });
}