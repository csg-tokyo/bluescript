import { handleCreateProjectCommand } from '../../../src/commands/project/create';
import * as fs from '../../../src/core/fs';
import * as path from 'path';
import {
    mockedCwd,
    mockedInquirer,
    mockedLogger,
    mockedShowErrorMessages,
    mockProcessExit,
} from '../mock-helpers';
import { deleteGlobalEnv, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32, spyGlobalSettings } from '../global-env-helper';

describe('create project command', () => {
    const DUMMY_CWD = path.join(__dirname, '../../../temp-files');
    const projectName = 'test-project';
    const projectDir = path.join(DUMMY_CWD, projectName);
    const projectBsconfig = path.join(projectDir, 'bsconfig.json');

    function deleteDummyProject() {
        if (fs.exists(projectDir)) {
            fs.removeDir(projectDir);
        }
    }

    beforeAll(() => {
        spyGlobalSettings('create');
    });

    beforeEach(() => {
        mockedCwd.mockReturnValue(DUMMY_CWD);
    });

    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
        deleteDummyProject();
    });

    it('should show warning and exit if update is needed', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv(true);
        mockedInquirer.prompt.mockResolvedValue({ board: 'esp32' });

        // --- Act ---
        await handleCreateProjectCommand(projectName, {});

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should create a new project', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        mockedInquirer.prompt.mockResolvedValue({ board: 'esp32' });

        // --- Act ---
        await handleCreateProjectCommand('test-project', {});

        // --- Assert ---
        expect(fs.exists(projectDir)).toBe(true);
        expect(fs.exists(projectBsconfig)).toBe(true);
    });

    it('shold skip asking board if board option exists.', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();

        // --- Act ---
        await handleCreateProjectCommand('test-project', { board: 'esp32' });

        // --- Assert ---
        expect(mockedInquirer.prompt).not.toHaveBeenCalled();
    });

    it('shold exit with an error if the environment for the board is not set up', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv();

        // --- Act ---
        await handleCreateProjectCommand('test-project', { board: 'esp32' });

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to create a new project.');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('The environment for esp32 is not set up.'));
        expect(process.exit).toHaveBeenCalled();

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should exit with an error for an unknown board name', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupGlobalEnvWithEsp32();

        // --- Act ---
        await handleCreateProjectCommand('test-project', { board: 'unknown-board' });

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to create a new project.');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
        expect(process.exit).toHaveBeenCalled();

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should exit if there is a directory with same name as the new project', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        fs.makeDir(projectDir);
        setupGlobalEnvWithEsp32();

        // --- Act ---
        await handleCreateProjectCommand('test-project', { board: 'esp32' });

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to create a new project.');
        expect(process.exit).toHaveBeenCalled();
        
        // --- Clean up ---
        exitSpy.mockRestore();
    });
});