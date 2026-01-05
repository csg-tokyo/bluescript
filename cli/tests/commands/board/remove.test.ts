import { handleRemoveCommand } from '../../../src/commands/board/remove';
import { setupDefaultGlobalEnv, deleteGlobalEnv, setupGlobalEnvWithEsp32, getGlobalConfig, spyGlobalSettings } from '../global-env-helper';
import {
    mockedInquirer,
    mockedLogger,
    mockedShowErrorMessages,
    mockProcessExit,
} from '../mock-helpers';


describe('board remove command', () => {
    beforeAll(() => {
        spyGlobalSettings('remove');
    });
    
    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
    });

    it('should show warning and exit if update is needed', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv(true);

        // --- Act ---
        await handleRemoveCommand('esp32', {});

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should cancel removal process if user denies the prompt', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        mockedInquirer.prompt.mockResolvedValue({ proceed: false });

        // --- Act ---
        await handleRemoveCommand('esp32', {});

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalledWith('Removal process cancelled by user.');
        expect(Object.keys(getGlobalConfig().boards)).toContain('esp32');
    });

    it('should not show prompt with force option', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();

        // --- Act ---
        await handleRemoveCommand('esp32', {force: true});

        // --- Assert ---
        expect(mockedInquirer.prompt).not.toHaveBeenCalled();
    });

    it('should exit with an error for an unknown board name', async () => {
        // --- Arrange ---
        setupDefaultGlobalEnv();
        const exitSpy = mockProcessExit();

        // --- Act ---
        await handleRemoveCommand('unknown-board', {});
        
        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to remove unknown-board');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
        expect(process.exit).toHaveBeenCalledWith(1);
        exitSpy.mockRestore();
    });

    describe('for esp32 board', () => {
        it('should perform removal if setup for esp32 exists', async () => {
            // --- Arrange ---
            setupGlobalEnvWithEsp32();
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });

            // --- Act ---
            await handleRemoveCommand('esp32', {});

            // --- Assert ---
            expect(Object.keys(getGlobalConfig().boards)).not.toContain('esp32');
            // No errors logged
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should warn and exit if setup is not completed', async () => {
            // --- Arrange ---
            setupDefaultGlobalEnv();

            // --- Act ---
            await handleRemoveCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith('The environment for esp32 is not set up. Nothing to remove.');
            // No further actions taken
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
        });
    });
});