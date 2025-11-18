import { handleRemoveCommand } from '../../../src/commands/board/remove';
import {
    mockedFs,
    mockedInquirer,
    mockedLogger,
    mockedShowErrorMessages,
    setupMocks,
    mockProcessExit,
} from '../../mocks/mock-helpers';

describe('board remove command', () => {
    let exitSpy: jest.SpyInstance;
    let mocks: ReturnType<typeof setupMocks>;

    beforeEach(() => {
        mocks = setupMocks();
        exitSpy = mockProcessExit();
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    describe('for esp32 board', () => {
        it('should perform removal if setup for esp32 exists', async () => {
            // --- Arrange ---
            mocks.globalConfigHandler.isBoardSetup.mockReturnValue(true);
            mocks.globalConfigHandler.globalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh',
                xtensaGccDir: '/xtensa-esp-elf/bin/',
            }
            mockedFs.exists.mockImplementation(() => true);

            // --- Act ---
            await handleRemoveCommand('esp32', {force: false});

            // --- Assert ---
            expect(mockedFs.removeDir).toHaveBeenCalled();
            // Remove board config and save
            expect(mocks.globalConfigHandler.removeBoardConfig).toHaveBeenCalledWith('esp32');
            expect(mocks.globalConfigHandler.saveGlobalConfig).toHaveBeenCalledTimes(1);
            // No errors logged
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should warn and exit if setup is not completed', async () => {
            // --- Arrange ---
            mocks.globalConfigHandler.isBoardSetup.mockReturnValue(false);
            mocks.globalConfigHandler.globalConfig.boards.esp32 = undefined;

            // --- Act ---
            await handleRemoveCommand('esp32', {force: false});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith('The environment for esp32 is not set up. Nothing to remove.');
            // No further actions taken
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedFs.removeDir).not.toHaveBeenCalled();
        });

        it('should cancel removal process if user denies the prompt', async () => {
            // --- Arrange ---
            mocks.globalConfigHandler.isBoardSetup.mockReturnValue(true);
            mocks.globalConfigHandler.globalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh',
                xtensaGccDir: '/xtensa-esp-elf/bin/',
            }
            mockedInquirer.prompt.mockResolvedValue({ proceed: false });

            // --- Act ---
            await handleRemoveCommand('esp32', {force: false});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith('Removal process cancelled by user.');
            // No further actions taken
            expect(mockedFs.removeDir).not.toHaveBeenCalled();
        });

        it('should not show prompt with force option', async () => {
            // --- Arrange ---
            mocks.globalConfigHandler.isBoardSetup.mockReturnValue(true);
            mocks.globalConfigHandler.globalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh',
                xtensaGccDir: '/xtensa-esp-elf/bin/',
            }
            mockedInquirer.prompt.mockResolvedValue({ proceed: false });

            // --- Act ---
            await handleRemoveCommand('esp32', {force: true});

            // --- Assert ---
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
        });

    });

    describe('Error Handling', () => {
        it('should exit with an error for an unknown board name', async () => {
            // --- Act ---
            await handleRemoveCommand('unknown-board', {force: false});
            
            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to remove unknown-board');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should handle errors during director removal', async () => {
            // --- Arrange ---
            mocks.globalConfigHandler.isBoardSetup.mockReturnValue(true);
            mockedFs.removeDir.mockImplementation((path) => {
                throw new Error('Failed to remove dir.');
            });

            // --- Act ---
            await handleRemoveCommand('esp32', {force: false});

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to remove esp32');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(expect.any(Error));
            expect(process.exit).toHaveBeenCalledWith(1);
        });
    });
});