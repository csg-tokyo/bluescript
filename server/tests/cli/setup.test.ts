import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

const mockUtils = {
    getHostOSType: jest.fn(),
    directoryExists: jest.fn(),
    createDirectory: jest.fn(),
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
    },
    executeCommand: jest.fn<(command: string, cwd?: string) => Promise<void>>(),
    deleteDirectory: jest.fn(),
};
jest.mock('../../src/cli/utils', () => mockUtils);

const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
    execSync: mockExecSync,
}));

const mockAxiosGet = jest.fn<(url: string) => Promise<{data: Buffer}>>();
jest.mock('axios', () => ({
    get: mockAxiosGet,
}));

const mockExtract = jest.fn<(zipPath: string, opts: { dir: string }) => Promise<void>>();
jest.mock('extract-zip', () => mockExtract);

const mockFs = {
    writeFileSync: jest.fn(),
    rmSync: jest.fn(),
};
jest.mock('fs', () => mockFs);


// -- Test --

import setup from '../../src/cli/setup';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('ESP32 Setup Script', () => {
    describe('setup', () => {
        it("should log a warning when device is 'host'", async () => {
            await setup('host');
            expect(mockUtils.logger.warn).toHaveBeenCalledWith('Not implemented yet.');
        });

        it("should log a warning for an unknown device", async () => {
            await setup('unknown_device');
            expect(mockUtils.logger.warn).toHaveBeenCalledWith('Unknown device.');
        });
    });

    describe('setupESP32', () => {
        it('should run the full setup process on macOS', async () => {
            // Prepare
            mockUtils.getHostOSType.mockReturnValue('macos');
            mockExecSync.mockImplementation((command) => {
                if (command === 'which brew') return;
                if (command === 'which git') return;
                throw new Error('command not found');
            });
            mockUtils.directoryExists.mockReturnValue(false);
            mockUtils.executeCommand.mockResolvedValue(undefined);
            mockAxiosGet.mockResolvedValue({ data: Buffer.from('zip data') });
            mockExtract.mockResolvedValue(undefined);

            // Execute
            await setup('esp32');

            // Verify prerequisite packages have been installed.
            expect(mockUtils.executeCommand).toHaveBeenCalledWith('brew install cmake');
            expect(mockUtils.executeCommand).toHaveBeenCalledWith('brew install ninja');
            expect(mockUtils.executeCommand).toHaveBeenCalledWith('brew install dfu-util');
            expect(mockUtils.executeCommand).toHaveBeenCalledWith('brew install ccache');

            // Verify ESP-IDF have been cloned.
            expect(mockUtils.executeCommand).toHaveBeenCalledWith(
                'git clone -b v5.4 --recursive https://github.com/espressif/esp-idf.git',
                expect.any(String)
            );

            // Verify the ESP-IDF installation script have benn run.
            expect(mockUtils.executeCommand).toHaveBeenCalledWith(expect.stringContaining('/esp-idf/install.sh'));

            // Verify BlueScript code have been downloaded.
            expect(mockAxiosGet).toHaveBeenCalledTimes(2); // runtime and modules
            expect(mockExtract).toHaveBeenCalledTimes(2);
        });

        it('should warn and exit if OS is not macOS', async () => {
            mockUtils.getHostOSType.mockReturnValue('windows');
            await setup('esp32');
            expect(mockUtils.logger.warn).toHaveBeenCalledWith('Not implemented yet.');
            expect(mockUtils.executeCommand).not.toHaveBeenCalled();
        });

        it('should throw an error if no package manager is found', async () => {
            mockUtils.getHostOSType.mockReturnValue('macos');
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });

            await setup('esp32');
            expect(mockUtils.logger.error).toHaveBeenCalledWith(
                'Failed to install prerequisite packages. Please install Homebrew or MacPorts and try again.'
            );
            expect(mockProcessExit).toHaveBeenCalledWith(1);
        });
    });

    describe('setupEspidf', () => {
        it('should skip cloning if esp-idf directory already exists', async () => {
            // Prepare
            mockUtils.getHostOSType.mockReturnValue('macos');
            mockExecSync.mockImplementation((command) => {
                if (command === 'which brew') return;
                if (command === 'which git') return;
                throw new Error('command not found');
            });
            mockAxiosGet.mockResolvedValue({ data: Buffer.from('zip data') });
            mockUtils.directoryExists.mockImplementation((path: any) => path.endsWith('/esp')); // /espディレクトリだけ存在

            // Execute
            await setup('esp32');

            // Verify `git clone` was not called.
            expect(mockUtils.executeCommand).not.toHaveBeenCalledWith(
                expect.stringContaining('git clone'),
                expect.any(String)
            );
            // Verify skip log.
            expect(mockUtils.logger.info).toHaveBeenCalledWith(expect.stringContaining('already exists.'));
            // Verify installation script have benn run.
            expect(mockUtils.executeCommand).toHaveBeenCalledWith(expect.stringContaining('/esp-idf/install.sh'));
        });
    });
});