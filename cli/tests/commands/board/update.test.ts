import { handleUpdateCommand } from '../../../src/commands/board/update';
import { deleteGlobalEnv, DUMMY_ESP_IDF_VERSION, getGlobalConfig, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32, DUMMY_VM_VERSION, spyGlobalSettings } from '../global-env-helper';
import { mockedDownloadAndUnzip, mockedExec } from '../mock-helpers';


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
        })

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
});