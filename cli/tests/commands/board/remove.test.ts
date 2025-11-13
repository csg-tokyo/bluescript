import { handleRemoveCommand } from '../../../src/commands/board/remove';
import { GlobalConfig } from '../../../src/core/config';
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
    let mockIsBoardSetup: jest.Mock;
    let mockUpdateGlobalConfig: jest.Mock;
    let mockRemoveBoardConfig: jest.Mock;
    let mockSaveGlobalConfig: jest.Mock;
    let mockGlobalConfig: GlobalConfig;

    beforeEach(() => {
        const mocks = setupMocks();
        mockIsBoardSetup = mocks.mockIsBoardSetup;
        mockUpdateGlobalConfig = mocks.mockUpdateGlobalConfig;
        mockRemoveBoardConfig = mocks.mockRemoveBoardConfig;
        mockSaveGlobalConfig = mocks.mockSaveGlobalConfig;
        mockGlobalConfig = mocks.mockGlobalConfig;

        exitSpy = mockProcessExit();
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    describe('for esp32 board', () => {
        it('should perform removal if setup for esp32 exists', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);
            mockGlobalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh'
            }
            mockedFs.exists.mockImplementation(() => true);

            // --- Act ---
            await handleRemoveCommand('esp32', {force: false});

            // --- Assert ---
            expect(mockedFs.removeDir).toHaveBeenCalled();
            // Remove board config and save
            expect(mockRemoveBoardConfig).toHaveBeenCalledWith('esp32');
            expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1);
            // No errors logged
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should warn and exit if setup is not completed', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(false);
            mockGlobalConfig.boards.esp32 = undefined;

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
            mockIsBoardSetup.mockReturnValue(true);
            mockGlobalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh'
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
            mockIsBoardSetup.mockReturnValue(true);
            mockGlobalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh'
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
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unknown board.'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should handle errors during director removal', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);
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