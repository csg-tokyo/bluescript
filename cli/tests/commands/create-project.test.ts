import { handleCreateProjectCommand } from '../../src/commands/create-project';
import {
    mockedFs,
    mockedInquirer,
    mockedLogger,
    mockedShowErrorMessages,
    setupMocks,
    mockProcessExit,
} from '../mocks/mock-helpers';

describe('create project command', () => {
    let exitSpy: jest.SpyInstance;
    let mocks: ReturnType<typeof setupMocks>;

    beforeEach(() => {
        mocks = setupMocks();
        exitSpy = mockProcessExit();
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    it('should create a new project', async () => {
        // --- Arrange ---
        mockedFs.exists.mockImplementation(() => false);
        mockedInquirer.prompt.mockResolvedValue({ board: 'esp32' });

        // --- Act ---
        await handleCreateProjectCommand('test-project', {});

        // --- Assert ---
        expect(mockedFs.makeDir).toHaveBeenCalledWith(expect.stringContaining('test-project'));
        expect(mocks.projectConfigHandler.set).toHaveBeenCalled();
        expect(mocks.projectConfigHandler.save).toHaveBeenCalled();
    });

    it('shold skip asking board if board option exists.', async () => {
        // --- Arrange ---
        mockedFs.exists.mockImplementation(() => false);

        // --- Act ---
        await handleCreateProjectCommand('test-project', { board: 'esp32' });

        // --- Assert ---
        expect(mockedInquirer.prompt).not.toHaveBeenCalled();
        expect(mockedFs.makeDir).toHaveBeenCalledWith(expect.stringContaining('test-project'));
        expect(mocks.projectConfigHandler.set).toHaveBeenCalled();
        expect(mocks.projectConfigHandler.save).toHaveBeenCalled();
    })

    it('should exit with an error for an unknown board name', async () => {
        // --- Act ---
        await handleCreateProjectCommand('test-project', { board: 'unknown-board' });

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to create a new project.');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
        expect(mockedFs.makeDir).not.toHaveBeenCalledWith(expect.stringContaining('test-project'));
    });

    it('should exit if there is a directory with same name as the new project', async () => {
        // --- Arrange ---
        mockedFs.exists.mockImplementation(() => true);

        // --- Act ---
        await handleCreateProjectCommand('test-project', { board: 'esp32' });

        // --- Assert ---
        expect(mockedFs.makeDir).not.toHaveBeenCalledWith(expect.stringContaining('test-project'));
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to create a new project.');
    });
});