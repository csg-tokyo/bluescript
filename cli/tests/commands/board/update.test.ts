import { handleUpdateCommand } from '../../../src/commands/board/update';
import { deleteGlobalEnv, DUMMY_ESP_IDF_VERSION, getGlobalConfig, getTestEspRootDir, getTestRuntimeDir, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32, DUMMY_VM_VERSION, spyGlobalSettings, DUMMY_OLD_VM_VERSION, DUMMY_OLD_ESP_IDF_VERSION, getEsp32IdfToolsExportPythonCommand, mockXtensaGccFromIdfToolsExport } from '../global-env-helper';
import { mockedDownloadAndUnzip, mockedSimpleExec, mockedExecWithLog, mockedExecShell, mockProcessExit } from '../mock-helpers';
import * as fs from '../../../src/core/fs';


function mockUpdateShellCommands(options: { gitCloneFails?: boolean }) {
    const pythonCmd = getEsp32IdfToolsExportPythonCommand();
    mockedSimpleExec.mockImplementation(async (cmd, args) => {
        if (cmd === pythonCmd && args.some((arg: string) => arg.includes('export'))) {
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
    });

    afterEach(() => {
        jest.clearAllMocks();
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
        setupDefaultGlobalEnv();

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).not.toHaveBeenCalledTimes(1);
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
        expect(mockedExecWithLog).not.toHaveBeenCalledWith(
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
});
