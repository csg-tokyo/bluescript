import { handleUpdateCommand } from '../../../src/commands/board/update';
import { deleteGlobalEnv, DUMMY_ESP_IDF_VERSION, getGlobalConfig, getTestEspRootDir, getTestRuntimeDir, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32, setupGlobalEnvWithHost, DUMMY_VM_VERSION, spyGlobalSettings, DUMMY_OLD_VM_VERSION, DUMMY_OLD_ESP_IDF_VERSION, isEsp32IdfToolsExportPythonCommand, mockXtensaGccFromIdfToolsExport } from '../global-env-helper';
import { mockedDownloadAndUnzip, mockedSimpleExec, mockedExecWithLog, mockedExecShell, mockProcessExit } from '../mock-helpers';
import { HostDarwinEnv } from '../../../src/platforms/board-env/host-env';
import * as fs from '../../../src/core/fs';
import * as path from 'path';
import os from 'os';

jest.mock('os', () => ({
    ...jest.requireActual('os'),
    platform: jest.fn(),
}));

const mockedOs = os as jest.Mocked<typeof os>;
const mockedBuildHostRuntime = jest.spyOn(HostDarwinEnv.prototype, 'buildHostRuntime');

function getTestHostShellFile() {
    return path.join(getTestRuntimeDir(), 'ports/host/build', 'shell');
}


function mockUpdateShellCommands(options: { gitCloneFails?: boolean }) {
    mockedSimpleExec.mockImplementation(async (cmd, args) => {
        if (isEsp32IdfToolsExportPythonCommand(cmd) && args.some((arg: string) => arg.includes('export'))) {
            return mockXtensaGccFromIdfToolsExport();
        }
        return '';
    });
    mockedExecWithLog.mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && options.gitCloneFails) {
            throw new Error('Failed to cloning ESP-IDF');
        }
        if (cmd === 'git') {
            return '';
        }
        return '';
    });
    mockedExecShell.mockImplementation(async () => {});
}

describe('board update command', () => {
    beforeAll(() => {
        spyGlobalSettings('update');
        mockedOs.platform.mockReturnValue('darwin');
        mockedBuildHostRuntime.mockResolvedValue();
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockedDownloadAndUnzip.mockResolvedValue(undefined);
        mockedBuildHostRuntime.mockResolvedValue();
        deleteGlobalEnv();
    });

    it('should update all environments.', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32(true, true);
        mockUpdateShellCommands({});

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
        expect(mockedExecWithLog).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone']),
            expect.any(Object),
        );
        expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('install'));
        expect(getGlobalConfig().version).toMatch(DUMMY_VM_VERSION);
        expect(getGlobalConfig().boards.esp32.idfVersion).toMatch(DUMMY_ESP_IDF_VERSION);
    });

    it('should skip updating runtime if version mismatch does not exist.', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv();

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(process.exit).toHaveBeenCalledWith(0);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should skip updating ESP-IDF if version mismatch of ESP-IDF does not exist.', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32(true, false);

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
        expect(mockedExecWithLog).not.toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone']),
            expect.any(Object),
        );
        expect(getGlobalConfig().version).toMatch(DUMMY_VM_VERSION);
    });

    it('should restore old runtime if error occures during downloading the new runtime', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupGlobalEnvWithEsp32(true, true);
        mockUpdateShellCommands({});
        mockedDownloadAndUnzip.mockImplementation(() => {
            throw new Error('Failed to download.');
        });

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
        expect(mockedExecWithLog).not.toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone']),
            expect.any(Object),
        );
        expect(mockedExecShell).not.toHaveBeenCalledWith(expect.stringContaining('install'));
        expect(fs.exists(getTestRuntimeDir())).toBe(true);
        expect(getGlobalConfig().version).toMatch(DUMMY_OLD_VM_VERSION);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should restore old runtime and esp dir if error occures during updating esp-idf', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupGlobalEnvWithEsp32(true, true);
        mockUpdateShellCommands({ gitCloneFails: true });

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
        expect(mockedExecWithLog).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['clone']),
            expect.any(Object),
        );
        expect(mockedExecShell).not.toHaveBeenCalledWith(expect.stringContaining('install'));
        expect(fs.exists(getTestRuntimeDir())).toBe(true);
        expect(fs.exists(getTestEspRootDir())).toBe(true);
        expect(getGlobalConfig().version).toMatch(DUMMY_OLD_VM_VERSION);
        expect(getGlobalConfig().boards.esp32.idfVersion).toMatch(DUMMY_OLD_ESP_IDF_VERSION);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    describe('for host board', () => {
        it('should update host environment.', async () => {
            // --- Arrange ---
            setupGlobalEnvWithHost(true);

            // --- Act ---
            await handleUpdateCommand();

            // --- Assert ---
            expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
            expect(mockedBuildHostRuntime).toHaveBeenCalledTimes(1);
            expect(getGlobalConfig().version).toMatch(DUMMY_VM_VERSION);
            expect(getGlobalConfig().boards.host.shellFile).toBe(getTestHostShellFile());
            expect(getGlobalConfig().boards.host.toolchain).toEqual({
                gcc: 'cc',
                ar: 'ar',
                make: 'make',
            });
        });

        it('should skip updating host if host is not setup.', async () => {
            // --- Arrange ---
            setupDefaultGlobalEnv(true);

            // --- Act ---
            await handleUpdateCommand();

            // --- Assert ---
            expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
            expect(mockedBuildHostRuntime).not.toHaveBeenCalled();
        });

        it('should restore old runtime if error occures during updating host', async () => {
            // --- Arrange ---
            const exitSpy = mockProcessExit();
            setupGlobalEnvWithHost(true);
            mockedBuildHostRuntime.mockRejectedValueOnce(
                new Error('Failed to compile host runtime.'),
            );

            // --- Act ---
            await handleUpdateCommand();

            // --- Assert ---
            expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
            expect(mockedBuildHostRuntime).toHaveBeenCalledTimes(1);
            expect(fs.exists(getTestRuntimeDir())).toBe(true);
            expect(getGlobalConfig().version).toMatch(DUMMY_OLD_VM_VERSION);

            // --- Clean up ---
            exitSpy.mockRestore();
        });
    });
});
