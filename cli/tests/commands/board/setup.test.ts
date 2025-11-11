import { handleSetupCommand } from '../../../src/commands/board/setup';
import { GlobalConfig, GlobalConfigHandler } from '../../../src/core/config';
import { logger, showErrorMessages } from '../../../src/core/logger';
import { exec } from '../../../src/core/shell';
import * as fs from '../../../src/core/fs';
import inquirer from 'inquirer';
import os from 'os';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn(),
}));


jest.mock('../../../src/core/logger', () => {
    const { SkipStep } = jest.requireActual('../../../src/core/logger');
    const mockDecorator = jest.fn().mockImplementation(
        (message: string) => {
        return function (
            target: any,
            propertyKey: string,
            descriptor: PropertyDescriptor
        ) {
            const originalMethod = descriptor.value;
            descriptor.value = async function (...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error) {
                if (error instanceof SkipStep) {return;}
                throw error;
            }
            };
            return descriptor;
        };
        }
    )
    return {
        ...jest.requireActual('../../../src/core/logger'),
        LogStep: mockDecorator,
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            success: jest.fn(),
            log: jest.fn(),
        },
        showErrorMessages: jest.fn(),
    }
});


jest.mock('../../../src/core/config');
jest.mock('../../../src/core/shell');
jest.mock('../../../src/core/fs');
jest.mock('inquirer');

const mockedExec = exec as jest.Mock;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedOs = os as jest.Mocked<typeof os>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedShowErrorMessages = showErrorMessages as jest.Mock;
const MockedGlobalConfigHandler = GlobalConfigHandler as jest.Mock;

describe('board setup command', () => {
    let exitSpy: jest.SpyInstance;

    let mockIsBoardSetup: jest.Mock;
    let mockUpdateGlobalConfig: jest.Mock;
    let mockUpdateBoardConfig: jest.Mock;
    let mockSaveGlobalConfig: jest.Mock;
    let mockGlobalConfig: GlobalConfig;

    beforeEach(() => {
        jest.clearAllMocks();

        mockIsBoardSetup = jest.fn();
        mockUpdateGlobalConfig = jest.fn();
        mockUpdateBoardConfig = jest.fn();
        mockSaveGlobalConfig = jest.fn();
        mockGlobalConfig = {
            version: 'v1.0.0',
            boards: {},
        };

        MockedGlobalConfigHandler.mockImplementation(() => ({
            globalConfig: mockGlobalConfig,
            isBoardSetup: mockIsBoardSetup,
            updateGlobalConfig: mockUpdateGlobalConfig,
            updateBoardConfig: mockUpdateBoardConfig,
            saveGlobalConfig: mockSaveGlobalConfig,
        }));
        
        mockedOs.platform.mockReturnValue('darwin');
        mockedInquirer.prompt.mockResolvedValue({ proceed: true });
        mockedExec.mockResolvedValue({ stdout: '', stderr: '' });
        mockedFs.exists.mockReturnValue(false);
        mockedFs.downloadAndUnzip.mockResolvedValue(undefined);
        
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    describe('for esp32 board on macOS', () => {
        it('should perform a full setup if not already set up', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(false);
            mockGlobalConfig.runtime = undefined;
            mockGlobalConfig.globalPackagesDir = undefined;
            
            mockedExec.mockImplementation(async (command: string) => {
                if (command.startsWith('which')) {
                    if (command.includes('brew') || command.includes('git')) {
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
            // 1. Ask user for confirmation
            expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);

            // 2. Dwonload runtime and packages
            expect(mockedFs.downloadAndUnzip).toHaveBeenCalledTimes(2);
            expect(mockUpdateGlobalConfig).toHaveBeenCalledTimes(2);
            
            // 3. Install required packages via Homebrew
            expect(mockedExec).toHaveBeenCalledWith('brew install cmake ninja dfu-util ccache');
            
            // 4. Instaall Python 3 if not present
            expect(mockedExec).toHaveBeenCalledWith('brew install python3');
            
            // 5. Clone ESP-IDF and run install script
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('git clone'), expect.any(Object));
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('install.sh'));

            // 6. Update board config and save
            expect(mockUpdateBoardConfig).toHaveBeenCalledWith('esp32', expect.any(Object));
            expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1);

            // 7. No errors logged
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should skip downloading runtime and packages if they exist', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(false);
            mockGlobalConfig.runtime = { version: '1.0.0', dir: '/path/runtime' };
            mockGlobalConfig.globalPackagesDir = '/path/packages';

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            // Confirm downloads are skipped
            expect(mockedFs.downloadAndUnzip).not.toHaveBeenCalled();
            // Confirm device setup proceeds
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('git clone'), expect.any(Object));
        });

        it('should warn and exit if setup is already completed', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith('The setup for esp32 has already been completed.');
            // No further actions taken
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).not.toHaveBeenCalled();
        });

        it('should cancel setup if user denies the prompt', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(false);
            mockedInquirer.prompt.mockResolvedValue({ proceed: false });

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith('Setup cancelled by user.');
            // No further actions taken
            expect(mockedExec).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should exit with an error for an unsupported OS', async () => {
            // --- Arrange ---
            mockedOs.platform.mockReturnValue('linux'); // サポート外のOS

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to setup esp32');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported OS.'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should exit with an error for an unknown board name', async () => {
            // --- Act ---
            await handleSetupCommand('unknown-board');
            
            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to setup unknown-board');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unknown device.'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should handle errors during shell command execution', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(false);
            const executionError = new Error('git command failed');
            mockedExec.mockImplementation(async (command) => {
                if (command.startsWith('git clone')) {
                    throw executionError;
                }
                return '';
            });

            // --- Act ---
            await handleSetupCommand('esp32');

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to setup esp32');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(expect.any(Error));
            expect(process.exit).toHaveBeenCalledWith(1);
        });
    });
});