import { handleSetupCommand } from '../../../src/commands/board/setup';
import { handleRemoveCommand } from '../../../src/commands/board/remove';
import { handleFlashRuntimeCommand } from '../../../src/commands/board/flash-runtime';
import os from 'os';
import * as path from 'path';
import * as fs from '../../../src/core/fs';
import {
    mockedSimpleExec,
    mockedExecWithLog,
    mockedExecShell,
    mockedInquirer,
    mockedLogger,
} from '../mock-helpers';
import {
    deleteGlobalEnv,
    getGlobalConfig,
    setupGlobalEnv,
    setupGlobalEnvWithEsp32,
    spyGlobalSettings,
    getTestEspRootDir,
    getTestEspIdfExportFile,
    getTestRuntimeDir,
    isEsp32IdfToolsExportPythonCommand,
    setupEmpyGlobalEnv,
    DUMMY_VM_VERSION,
} from '../global-env-helper';
import { GLOBAL_SETTINGS } from '../../../src/config/constants';
import { Esp32UnixEnv } from '../../../src/platforms/board-env/esp32-env';

jest.mock('serialport', () => ({ SerialPort: { list: jest.fn(async () => []) } }));
jest.mock('os', () => ({
    ...jest.requireActual('os'),
    platform: jest.fn(() => 'darwin'),
}));

function esp32s3ToolchainDir() {
    return path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, '.espressif/tools/xtensa-esp-elf/bin');
}

function mockShellCommands() {
    mockedSimpleExec.mockImplementation(async (cmd, args) => {
        if (cmd === 'which') {
            return '';
        }
        if (isEsp32IdfToolsExportPythonCommand(cmd) && args.some((arg: string) => arg.includes('export'))) {
            const gccDir = esp32s3ToolchainDir();
            fs.makeDir(gccDir);
            fs.writeFile(path.join(gccDir, 'xtensa-esp32-elf-gcc'), '');
            fs.writeFile(path.join(gccDir, 'xtensa-esp32s3-elf-gcc'), '');
            return `PATH=${gccDir}:/xtensa-esp-elf-gdb/bin`;
        }
        if (cmd === 'python' && args[1]?.includes('import sys')) {
            return '3';
        }
        return '';
    });
    mockedExecWithLog.mockImplementation(async () => '');
    mockedExecShell.mockImplementation(async () => {});
}

function setupGlobalEnvWithEsp32AndEsp32s3() {
    const board = {
        idfVersion: new Esp32UnixEnv().idfVersion,
        rootDir: getTestEspRootDir(),
        exportFile: getTestEspIdfExportFile(),
        toolchain: { gcc: 'gcc', ar: 'ar', ld: 'ld', make: 'make', python: 'python' },
    };
    setupGlobalEnv({
        version: DUMMY_VM_VERSION,
        runtimeDir: getTestRuntimeDir(),
        boards: { esp32: board, esp32s3: { ...board } },
    });
    fs.makeDir(getTestEspRootDir());
    fs.makeDir(getTestRuntimeDir());
}

describe('esp32s3 board', () => {
    beforeAll(() => {
        spyGlobalSettings('esp32s3');
    });

    beforeEach(() => {
        deleteGlobalEnv();
    });

    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
    });

    describe('setup', () => {
        it('clones ESP-IDF and installs the esp32s3 toolchain when no ESP32-family board is set up', async () => {
            setupEmpyGlobalEnv();
            mockShellCommands();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });

            await handleSetupCommand('esp32s3', {});

            expect(mockedExecWithLog).toHaveBeenCalledWith(
                'git', expect.arrayContaining(['clone']), expect.anything());
            expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('install.sh" esp32s3'));
            const config = getGlobalConfig();
            expect(config.boards.esp32s3.toolchain.gcc).toBe(path.join(esp32s3ToolchainDir(), 'xtensa-esp32s3-elf-gcc'));
            expect(config.boards.esp32s3.toolchain.ld).toBe(path.join(esp32s3ToolchainDir(), 'xtensa-esp32s3-elf-ld'));
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('reuses the ESP-IDF installed for esp32 instead of cloning again', async () => {
            setupGlobalEnvWithEsp32();
            const env = new Esp32UnixEnv('esp32s3');
            fs.makeDir(path.dirname(env.idfToolsPyFile));
            fs.writeFile(env.idfToolsPyFile, '');
            const marker = path.join(env.espRootDir, 'MARKER');
            fs.writeFile(marker, 'keep');
            mockShellCommands();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });

            await handleSetupCommand('esp32s3', {});

            expect(mockedExecWithLog).not.toHaveBeenCalledWith('git', expect.anything(), expect.anything());
            expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('install.sh" esp32s3'));
            // The shared ESP-IDF directory must not be wiped.
            expect(fs.exists(marker)).toBe(true);
            const config = getGlobalConfig();
            expect(Object.keys(config.boards)).toEqual(expect.arrayContaining(['esp32', 'esp32s3']));
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('keeps the shared ESP-IDF directory while esp32 is still set up', async () => {
            setupGlobalEnvWithEsp32AndEsp32s3();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });

            await handleRemoveCommand('esp32s3', {});

            expect(fs.exists(getTestEspRootDir())).toBe(true);
            expect(Object.keys(getGlobalConfig().boards)).not.toContain('esp32s3');
            expect(Object.keys(getGlobalConfig().boards)).toContain('esp32');
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('removes the ESP-IDF directory when it is the last ESP32-family board', async () => {
            setupGlobalEnvWithEsp32AndEsp32s3();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });

            await handleRemoveCommand('esp32s3', {});
            await handleRemoveCommand('esp32', {});

            expect(fs.exists(getTestEspRootDir())).toBe(false);
            expect(Object.keys(getGlobalConfig().boards)).not.toContain('esp32');
        });
    });

    describe('flash-runtime', () => {
        it('builds with the esp32s3 target in its own build directory', async () => {
            setupGlobalEnvWithEsp32AndEsp32s3();
            mockedExecShell.mockImplementation(async () => {});

            await handleFlashRuntimeCommand('esp32s3', { port: '/dev/ttyACM0' });

            expect(mockedExecShell).toHaveBeenCalledWith(
                expect.stringContaining('-B build-esp32s3 -D IDF_TARGET=esp32s3 -D SDKCONFIG=sdkconfig.esp32s3 erase-flash'),
                { cwd: expect.stringContaining(path.join('ports', 'esp32')) });
            expect(mockedExecShell).toHaveBeenCalledWith(
                expect.stringContaining('-B build-esp32s3 -D IDF_TARGET=esp32s3 -D SDKCONFIG=sdkconfig.esp32s3 -D DEVICE_NAME='),
                { cwd: expect.stringContaining(path.join('ports', 'esp32')) });
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('fails when only esp32 is set up', async () => {
            setupGlobalEnvWithEsp32();

            await handleFlashRuntimeCommand('esp32s3', { port: '/dev/ttyACM0' });

            expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('esp32s3 is not set up'));
            expect(mockedExecShell).not.toHaveBeenCalled();
        });
    });
});

describe('board build-runtime', () => {
    beforeAll(() => { spyGlobalSettings('build-runtime'); });
    beforeEach(() => { deleteGlobalEnv(); });
    afterEach(() => { jest.clearAllMocks(); deleteGlobalEnv(); });

    it('builds the esp32s3 runtime without flashing and reports the build directory', async () => {
        const { handleBuildRuntimeCommand } = await import('../../../src/commands/board/build-runtime');
        setupGlobalEnvWithEsp32AndEsp32s3();
        mockedExecShell.mockImplementation(async () => {});

        await handleBuildRuntimeCommand('esp32s3', { deviceName: 'my-s3' });

        expect(mockedExecShell).toHaveBeenCalledTimes(1);
        const [cmd] = mockedExecShell.mock.calls[0];
        expect(cmd).toContain('-B build-esp32s3 -D IDF_TARGET=esp32s3 -D SDKCONFIG=sdkconfig.esp32s3 -D DEVICE_NAME=my-s3 build');
        expect(cmd).not.toContain('flash');
        expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining(path.join('ports', 'esp32', 'build-esp32s3')));
        expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it('warns when the board is not set up', async () => {
        const { handleBuildRuntimeCommand } = await import('../../../src/commands/board/build-runtime');
        setupGlobalEnvWithEsp32();

        await handleBuildRuntimeCommand('esp32s3', {});

        expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('esp32s3 is not set up'));
        expect(mockedExecShell).not.toHaveBeenCalled();
    });
});
