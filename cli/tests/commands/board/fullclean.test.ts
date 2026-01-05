import { handleFullcleanCommand } from '../../../src/commands/board/full-clean';
import { setupDefaultGlobalEnv, spyGlobalSettings } from '../global-env-helper';
import * as fs from '../../../src/core/fs';
import { mockedInquirer, mockedLogger, mockProcessExit } from '../mock-helpers';
import { GLOBAL_SETTINGS } from '../../../src/config/constants';


describe('board fullclean command', () => {
    beforeAll(() => {
        spyGlobalSettings('fullclean');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should not show warning even if there is version mismatch', async () => {
        // --- Arrange ---
        setupDefaultGlobalEnv(true);
        mockedInquirer.prompt.mockResolvedValue({ proceed: true });
        const exitSpy = mockProcessExit();

        // --- Act ---
        await handleFullcleanCommand({})

        // --- Assert ---
        expect(mockedLogger.warn).not.toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
        expect(fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_DIR)).toBe(false);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should not show prompt if force option passed', async () => {
        // --- Arrange ---
        setupDefaultGlobalEnv(true);

        // --- Act ---
        await handleFullcleanCommand({force: true});

        // --- Assert ---
        expect(mockedInquirer.prompt).not.toHaveBeenCalled();
        expect(fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_DIR)).toBe(false);
    });

    it('should clean up bluescript dir.', async () => {
        // --- Arrange ---
        setupDefaultGlobalEnv(true);
        mockedInquirer.prompt.mockResolvedValue({ proceed: true });

        // --- Act ---
        await handleFullcleanCommand({force: true});

        // --- Assert ---
        expect(mockedInquirer.prompt).not.toHaveBeenCalled();
        expect(fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_DIR)).toBe(false);
    });
});