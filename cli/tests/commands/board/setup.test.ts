import { handleSetupCommand } from '../../../src/commands/board/setup';
import os from 'os';
import {
    mockedDownloadAndUnzip,
    mockedSimpleExec,
    mockedExecWithLog,
    mockedExecShell,
    mockedInquirer,
    mockedLogger,
    mockProcessExit,
} from '../mock-helpers';
import {
    deleteGlobalEnv,
    getGlobalConfig,
    setupDefaultGlobalEnv,
    setupEmpyGlobalEnv,
    setupGlobalEnvWithEsp32,
    setupGlobalEnvWithHost,
    spyGlobalSettings,
    getTestEspRootDir,
    isEsp32IdfToolsExportPythonCommand,
    mockXtensaGccFromIdfToolsExport,
} from '../global-env-helper';
import { HostUnixEnv } from '../../../src/platforms/board-env/host-env';
import * as path from 'path';
import * as fs from '../../../src/core/fs';


const mockedBuildHostRuntime = jest
    .spyOn(HostUnixEnv.prototype, 'buildHostRuntime')
    .mockResolvedValue();

jest.mock('os', () => ({
    ...jest.requireActual('os'),
    platform: jest.fn(),
}));

export const mockedOs = os as jest.Mocked<typeof os>;
mockedOs.platform.mockReturnValue('darwin');

const SOURCE_IDF_DIR = path.join(__dirname, '../../temp-files/source-esp-idf-for-setup');

function createSourceEspIdfDir() {
    if (fs.exists(SOURCE_IDF_DIR)) {
        fs.removeDir(SOURCE_IDF_DIR);
    }
    fs.makeDir(SOURCE_IDF_DIR);
    fs.writeFile(path.join(SOURCE_IDF_DIR, 'MARKER'), 'ok');
}

function removeSourceEspIdfDir() {
    if (fs.exists(SOURCE_IDF_DIR)) {
        fs.removeDir(SOURCE_IDF_DIR);
    }
}

function mockEsp32ShellCommands(options: {
    whichFound?: string[];
    pythonMajor?: string;
    gitCloneFails?: boolean;
    /** Printed by idf_tools.get_idf_version() (without leading "v"). */
    idfVersion?: string;
}) {
    mockedSimpleExec.mockImplementation(async (cmd, args) => {
        if (cmd === 'which') {
            if (options.whichFound?.includes(args[0])) {
                return '';
            }
            throw new Error('not found');
        }
        if (isEsp32IdfToolsExportPythonCommand(cmd) && args.some((arg: string) => arg.includes('export'))) {
            return mockXtensaGccFromIdfToolsExport();
        }
        if (isEsp32IdfToolsExportPythonCommand(cmd) && args[1]?.includes('get_idf_version')) {
            return options.idfVersion ?? '5.4';
        }
        if (cmd === 'python' && args[1]?.includes('import sys')) {
            return options.pythonMajor ?? '3';
        }
        return '';
    });
    mockedExecWithLog.mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && options.gitCloneFails) {
            throw new Error('git command failed');
        }
        if (cmd === 'git' || cmd === 'brew') {
            return '';
        }
        return '';
    });
    mockedExecShell.mockImplementation(async () => {});
}

function mockHostShellCommands(options: { ccMissing?: boolean }) {
    mockedSimpleExec.mockImplementation(async (cmd, args) => {
        if (cmd === 'which') {
            if (options.ccMissing && args[0] === 'cc') {
                throw new Error('not found');
            }
            return '';
        }
        return '';
    });
}


describe('board setup command', () => {
    beforeAll(() => {
        spyGlobalSettings('setup');
        jest.spyOn(HostUnixEnv.prototype, 'buildHostRuntime').mockResolvedValue();
    })

    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
        removeSourceEspIdfDir();
    });

    it('should show warning and exit if update is needed', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv(true);

        // --- Act ---
        await handleSetupCommand('esp32', {});

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should cancel setup if user denies the prompt', async () => {
        // --- Arrange ---
        mockedInquirer.prompt.mockResolvedValue({ proceed: false });

        // --- Act ---
        await handleSetupCommand('esp32', {});

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalledWith('Setup cancelled by user.');
        // No further actions taken
        expect(mockedSimpleExec).not.toHaveBeenCalled();
        expect(mockedExecWithLog).not.toHaveBeenCalled();
        expect(mockedExecShell).not.toHaveBeenCalled();
    });

    it('should exit with an error for an unknown board name', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();

        // --- Act ---
        await handleSetupCommand('unknown-board', {});
        
        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up unknown-board');
        expect(mockedLogger.showError).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
        expect(process.exit).toHaveBeenCalledWith(1);
        exitSpy.mockRestore();
    });

    it('should handle errors during shell command execution', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        mockedInquirer.prompt.mockResolvedValue({ proceed: true });
        mockEsp32ShellCommands({ gitCloneFails: true });

        // --- Act ---
        await handleSetupCommand('esp32', {});

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up esp32');
        expect(mockedLogger.showError).toHaveBeenCalledWith(expect.any(Error));
        expect(process.exit).toHaveBeenCalledWith(1);
        exitSpy.mockRestore();
    });

    describe('for esp32 board on macOS', () => {
        it('should perform a full setup if not already set up', async () => {
            // --- Arrange ---
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockEsp32ShellCommands({
                whichFound: ['brew', 'git', 'make'],
            });
            setupEmpyGlobalEnv();

            // --- Act ---
            await handleSetupCommand('esp32', {});

            // --- Assert ---
            // 1. Ask user for confirmation
            expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);

            // 2. Dwonload runtime
            expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
            
            // 3. Install required packages via Homebrew
            expect(mockedExecWithLog).toHaveBeenCalledWith(
                'brew',
                ['install', 'cmake', 'ninja', 'dfu-util', 'ccache'],
            );

            // 4. Clone ESP-IDF and run install script
            expect(mockedExecWithLog).toHaveBeenCalledWith(
                'git',
                expect.arrayContaining(['clone']),
                expect.any(Object),
            );
            expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('install.sh'));

            // 5. Update and save config
            expect(Object.keys(getGlobalConfig().boards)).toContain('esp32');

            // 6. No errors logged
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should skip downloading runtime if it exist', async () => {
            // --- Arrange ---
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            setupDefaultGlobalEnv();
            mockEsp32ShellCommands({
                whichFound: ['brew', 'git', 'make'],
            });

            // --- Act ---
            await handleSetupCommand('esp32', {});

            // --- Assert ---
            // Confirm downloads are skipped
            expect(mockedDownloadAndUnzip).not.toHaveBeenCalled();
            // Confirm device setup proceeds
            expect(mockedExecWithLog).toHaveBeenCalledWith(
                'git',
                expect.arrayContaining(['clone']),
                expect.any(Object),
            );
        });

        it('shold skip install required packages if all packages are installed', async () => {
            // --- Arrange ---
            setupEmpyGlobalEnv();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockEsp32ShellCommands({
                whichFound: ['brew', 'git', 'cmake', 'ninja', 'dfu-util', 'ccache', 'make'],
            });

            // --- Act ---
            await handleSetupCommand('esp32', {});

            // --- Assert ---
            expect(mockedExecWithLog).not.toHaveBeenCalledWith('brew', ['install', 'cmake']);
        });

        it('shold stop if python3 is not installed', async () => {
            // --- Arrange ---
            setupEmpyGlobalEnv();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            const exitSpy = mockProcessExit();
            mockEsp32ShellCommands({
                whichFound: ['brew', 'git', 'make'],
                pythonMajor: '2',
            });

            // --- Act ---
            await handleSetupCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.showError).toHaveBeenCalledWith(new Error('Cannot find Python3. Please install Python3 and try again.'));
            expect(process.exit).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        })

        it('should warn and exit if setup is already completed', async () => {
            // --- Arrange ---
            setupGlobalEnvWithEsp32();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });

            // --- Act ---
            await handleSetupCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith('The setup for esp32 has already been completed.');
            // No further actions taken
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedSimpleExec).not.toHaveBeenCalled();
        expect(mockedExecWithLog).not.toHaveBeenCalled();
        expect(mockedExecShell).not.toHaveBeenCalled();
        });

        it('should exit with an error for an unsupported OS', async () => {
            // --- Arrange ---
            const exitSpy = mockProcessExit();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockedOs.platform.mockReturnValue('openbsd');
            setupGlobalEnvWithEsp32()

            // --- Act ---
            await handleSetupCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up esp32');
            expect(mockedLogger.showError).toHaveBeenCalledWith(new Error('Unsupported OS type: openbsd.'));
            expect(process.exit).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
            mockedOs.platform.mockReturnValue('darwin');
        });

        it('should copy ESP-IDF from --esp-idf instead of cloning', async () => {
            // --- Arrange ---
            setupEmpyGlobalEnv();
            createSourceEspIdfDir();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockEsp32ShellCommands({
                whichFound: ['brew', 'git', 'make'],
                idfVersion: '5.4',
            });

            // --- Act ---
            await handleSetupCommand('esp32', { espIdf: SOURCE_IDF_DIR });

            // --- Assert ---
            expect(mockedExecWithLog).not.toHaveBeenCalledWith(
                'git',
                expect.arrayContaining(['clone']),
                expect.any(Object),
            );
            expect(fs.exists(path.join(getTestEspRootDir(), 'esp-idf', 'MARKER'))).toBe(true);
            expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('install.sh'));
            expect(Object.keys(getGlobalConfig().boards)).toContain('esp32');
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should exit with an error if --esp-idf path does not exist', async () => {
            // --- Arrange ---
            setupEmpyGlobalEnv();
            const missingPath = path.join(__dirname, '../../temp-files/missing-esp-idf');
            const exitSpy = mockProcessExit();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockEsp32ShellCommands({
                whichFound: ['brew', 'git', 'make'],
            });

            // --- Act ---
            await handleSetupCommand('esp32', { espIdf: missingPath });

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up esp32');
            expect(mockedLogger.showError).toHaveBeenCalledWith(
                new Error(`ESP-IDF directory not found: ${path.resolve(missingPath)}`),
            );
            expect(mockedExecWithLog).not.toHaveBeenCalledWith(
                'git',
                expect.arrayContaining(['clone']),
                expect.any(Object),
            );
            expect(process.exit).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });

        it('should exit with an error if --esp-idf version does not match', async () => {
            // --- Arrange ---
            setupEmpyGlobalEnv();
            createSourceEspIdfDir();
            const exitSpy = mockProcessExit();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockEsp32ShellCommands({
                whichFound: ['brew', 'git', 'make'],
                idfVersion: '5.3',
            });

            // --- Act ---
            await handleSetupCommand('esp32', { espIdf: SOURCE_IDF_DIR });

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up esp32');
            expect(mockedLogger.showError).toHaveBeenCalledWith(
                new Error(
                    [
                        `The ESP-IDF version of ${path.resolve(SOURCE_IDF_DIR)} is not correct.`,
                        'The expected version is v5.4, but got v5.3',
                    ].join('\n'),
                ),
            );
            expect(fs.exists(path.join(getTestEspRootDir(), 'esp-idf', 'MARKER'))).toBe(false);
            expect(process.exit).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });
    });

    describe('for host board on macOS', () => {
        beforeEach(() => {
            mockedOs.platform.mockReturnValue('darwin');
        });

        it('should perform a full setup if not already set up', async () => {
            setupEmpyGlobalEnv();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockHostShellCommands({});

            await handleSetupCommand('host', {});

            expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);
            expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
            expect(mockedBuildHostRuntime).toHaveBeenCalledTimes(1);
            expect(Object.keys(getGlobalConfig().boards)).toContain('host');
            expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining('bscript project create'));
            expect(mockedLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('flash-runtime'));
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should exit with an error when cc is missing', async () => {
            setupEmpyGlobalEnv();
            const exitSpy = mockProcessExit();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockHostShellCommands({ ccMissing: true });

            await handleSetupCommand('host', {});

            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up host');
            expect(process.exit).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });

        it('should warn and exit if setup is already completed', async () => {
            setupGlobalEnvWithHost();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });

            await handleSetupCommand('host', {});

            expect(mockedLogger.warn).toHaveBeenCalledWith('The setup for host has already been completed.');
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedBuildHostRuntime).not.toHaveBeenCalled();
        });
    });
});