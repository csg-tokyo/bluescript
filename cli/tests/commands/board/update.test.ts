import { handleUpdateCommand } from '../../../src/commands/board/update';
import { deleteGlobalEnv, DUMMY_ESP_IDF_VERSION, getGlobalConfig, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32, DUMMY_VM_VERSION, spyGlobalSettings, DUMMY_OLD_VM_VERSION, DUMMY_OLD_ESP_IDF_VERSION } from '../global-env-helper';
import { mockedDownloadAndUnzip, mockedExec } from '../mock-helpers';
import * as fs from '../../../src/core/fs';
import { GLOBAL_SETTINGS } from '../../../src/config/constants';


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
        mockedExec.mockImplementation((command: string) => {
            if (command.endsWith('which xtensa-esp32-elf-gcc')) {
                return 'xtensa-esp-elf/bin';
            }
            return '';
        });

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
        expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('git clone'),expect.any(Object));
        expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('install'));
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
        expect(mockedExec).not.toHaveBeenCalledWith(expect.stringContaining('git clone'),expect.any(Object));
        expect(getGlobalConfig().version).toMatch(DUMMY_VM_VERSION);
    });

    it('should restore old runtime if error occures during downloading the new runtime', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32(true, true);
        mockedExec.mockImplementation((command: string) => {
            if (command.endsWith('which xtensa-esp32-elf-gcc')) {
                return 'xtensa-esp-elf/bin';
            }
            return '';
        });
        mockedDownloadAndUnzip.mockImplementation(() => {
            throw new Error('Failed to download.');
        })

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
        expect(mockedExec).not.toHaveBeenCalledWith(expect.stringContaining('git clone'),expect.any(Object));
        expect(mockedExec).not.toHaveBeenCalledWith(expect.stringContaining('install'));
        expect(fs.exists(GLOBAL_SETTINGS.RUNTIME_DIR)).toBe(true);
        expect(getGlobalConfig().version).toMatch(DUMMY_OLD_VM_VERSION);
    });

    it('should restore old runtime and esp dir if error occures during updating esp-idf', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32(true, true);
        mockedExec.mockImplementation((command: string) => {
            if (command.startsWith('git clone')) {
                throw new Error('Failed to cloning ESP-IDF');
            }
            return '';
        });

        // --- Act ---
        await handleUpdateCommand();

        // --- Assert ---
        expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
        expect(mockedExec).not.toHaveBeenCalledWith(expect.stringContaining('git clone'),expect.any(Object));
        expect(mockedExec).not.toHaveBeenCalledWith(expect.stringContaining('install'));
        expect(fs.exists(GLOBAL_SETTINGS.RUNTIME_DIR)).toBe(true);
        expect(fs.exists(GLOBAL_SETTINGS.ESP_ROOT_DIR)).toBe(true);
        expect(getGlobalConfig().version).toMatch(DUMMY_OLD_VM_VERSION);
        expect(getGlobalConfig().boards.esp32.idfVersion).toMatch(DUMMY_OLD_ESP_IDF_VERSION);
    });
});