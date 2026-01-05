import { handleSetupCommand } from '../../../src/commands/board/setup';
import os from 'os';
import {
    mockedDownloadAndUnzip,
    mockedExec,
    mockedInquirer,
    mockedLogger,
    mockedShowErrorMessages,
    mockProcessExit,
} from '../mock-helpers';
import { deleteGlobalEnv, getGlobalConfig, setupDefaultGlobalEnv, setupEmpyGlobalEnv, setupGlobalEnvWithEsp32, spyGlobalSettings } from '../global-env-helper';

jest.mock('os', () => ({
    ...jest.requireActual('os'),
    platform: jest.fn(),
}));

export const mockedOs = os as jest.Mocked<typeof os>;
mockedOs.platform.mockReturnValue('darwin');


describe('board setup command', () => {
    beforeAll(() => {
        spyGlobalSettings('setup');
    })

    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
    });

    it('should show warning and exit if update is needed', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv(true);

        // --- Act ---
        await handleSetupCommand('esp32');

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should cancel setup if user denies the prompt', async () => {
        // --- Arrange ---
        mockedInquirer.prompt.mockResolvedValue({ proceed: false });

        // --- Act ---
        await handleSetupCommand('esp32');

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalledWith('Setup cancelled by user.');
        // No further actions taken
        expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should exit with an error for an unknown board name', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();

        // --- Act ---
        await handleSetupCommand('unknown-board');
        
        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up unknown-board');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
        expect(process.exit).toHaveBeenCalledWith(1);
        exitSpy.mockRestore();
    });

    it('should handle errors during shell command execution', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        mockedInquirer.prompt.mockResolvedValue({ proceed: true });
        mockedExec.mockImplementation(async (command) => {
            if (command.startsWith('git clone')) {
                throw new Error('git command failed');;
            }
            return '';
        });

        // --- Act ---
        await handleSetupCommand('esp32');

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up esp32');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(expect.any(Error));
        expect(process.exit).toHaveBeenCalledWith(1);
        exitSpy.mockRestore();
    });

    describe('for esp32 board on macOS', () => {
        it('should perform a full setup if not already set up', async () => {
            // --- Arrange ---
            mockedInquirer.prompt.mockResolvedValue({ proceed: true });
            mockedExec.mockImplementation(async (command: string) => {
                if (command.startsWith('which')) {
                    if (command.includes('brew') || command.includes('git')) {
                        return '';
                    }
                    if (command.includes('xtensa-esp32-elf-gcc')) {
                        return '/xtensa-esp-elf/bin/xtensa-esp32-elf-gcc';
                    }
                    throw new Error('not found');
                }
                if (command.includes('python --version')) {
                    return 'Python 2.7.18';
                }
                return '';
            });

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            // 1. Ask user for confirmation
            expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);

            // 2. Dwonload runtime
            expect(mockedDownloadAndUnzip).toHaveBeenCalledTimes(1);
            
            // 3. Install required packages via Homebrew
            expect(mockedExec).toHaveBeenCalledWith('brew install cmake ninja dfu-util ccache');
            
            // 4. Instaall Python 3 if not present
            expect(mockedExec).toHaveBeenCalledWith('brew install python3');
            
            // 5. Clone ESP-IDF and run install script
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('git clone'), expect.any(Object));
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('install.sh'));

            // 6. Update and save config
            expect(Object.keys(getGlobalConfig().boards)).toContain('esp32');

            // 7. No errors logged
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should skip downloading runtime if it exist', async () => {
            // --- Arrange ---
            setupDefaultGlobalEnv();

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            // Confirm downloads are skipped
            expect(mockedDownloadAndUnzip).not.toHaveBeenCalled();
            // Confirm device setup proceeds
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('git clone'), expect.any(Object));
        });

        it('shold skip install required packages if all packages are installed', async () => {
            // --- Arrange ---
            setupEmpyGlobalEnv();
            mockedExec.mockImplementation(async (command: string) => {
                if (command.startsWith('which')) {
                    if (command.includes('brew') || command.includes('git')) {
                        return '';
                    }
                    if (command.includes('cmake') || command.includes('ninja') || command.includes('dfu-util') || command.includes('ccache')) {
                        return '';
                    }
                    throw new Error('not found');
                }
                if (command.includes('python --version')) {
                    return 'Python 2.7.18';
                }
                return '';
            });

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedExec).not.toHaveBeenCalledWith(expect.stringContaining('brew install cmake'));
        });

        it('shold skip install python3 if python3 is already installed', async () => {
            // --- Arrange ---
            setupEmpyGlobalEnv();
            mockedExec.mockImplementation(async (command: string) => {
                if (command.startsWith('which')) {
                    if (command.includes('brew') || command.includes('git')) {
                        return '';
                    }
                    throw new Error('not found');
                }
                if (command.includes('python --version')) {
                    return 'Python 3.7.18';
                }
                return '';
            });

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedExec).not.toHaveBeenCalledWith('brew install python3');
        })

        it('should warn and exit if setup is already completed', async () => {
            // --- Arrange ---
            setupGlobalEnvWithEsp32();

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith('The setup for esp32 has already been completed.');
            // No further actions taken
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).not.toHaveBeenCalled();
        });

        it('should exit with an error for an unsupported OS', async () => {
            // --- Arrange ---
            const exitSpy = mockProcessExit();
            mockedOs.platform.mockReturnValue('linux');
            setupGlobalEnvWithEsp32()

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to set up esp32');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported OS.'));
            expect(process.exit).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });
    });
});