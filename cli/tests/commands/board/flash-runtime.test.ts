import { handleFlashRuntimeCommand } from '../../../src/commands/board/flash-runtime';
import { SerialPort } from 'serialport';
import { GlobalConfig } from '../../../src/core/config';
import {
  mockedInquirer,
  mockedLogger,
  mockedShowErrorMessages,
  setupMocks,
  mockProcessExit,
  mockedExec,
} from '../../mocks/mock-helpers';

jest.mock('serialport');
const mockedSerialPort = SerialPort as jest.Mocked<typeof SerialPort>;
mockedSerialPort.list.mockResolvedValue([{
    path: '/tty/port1',
    manufacturer: undefined, 
    serialNumber: undefined, 
    pnpId: undefined,
    locationId: undefined, 
    productId: undefined, 
    vendorId: undefined
}]);

describe('board flash-runtime command', () => {
    let exitSpy: jest.SpyInstance;
    let mockIsBoardSetup: jest.Mock;
    let mockGlobalConfig: GlobalConfig;

    beforeEach(() => {
        const mocks = setupMocks();
        mockIsBoardSetup = mocks.mockIsBoardSetup;
        mockGlobalConfig = mocks.mockGlobalConfig;
        mockGlobalConfig.runtime = {
            dir: '/.bluescript/microcontroller',
            version: '1.0.0'
        }
        exitSpy = mockProcessExit();
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    describe('for esp32 board', () => {
        it('should flash runtime to board if setup for esp32 exists', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);
            mockGlobalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh'
            }
            mockedInquirer.prompt.mockResolvedValue({ port: '/tty/port1' });

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('idf.py build flash -p'), {cwd: '/.bluescript/microcontroller/ports/esp32'});
            // No errors logged
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should warn and exit if setup is not completed', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(false);
            mockGlobalConfig.boards.esp32 = undefined;

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith(`The environment for esp32 is not set up. Run 'bluescript board setup esp32' and try again.`);
            // No further actions taken
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).not.toHaveBeenCalled();
        });

        it('should not show prompt if port is specified', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);
            mockGlobalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh'
            }

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', { port: '/tty/port1' });

            // --- Assert ---
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).toHaveBeenCalled();
        });

        it('should show an error and exit if no serial ports are found', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);
            mockGlobalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh'
            }
            mockedSerialPort.list.mockResolvedValue([]);

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).not.toHaveBeenCalled();
        });

        it('shold show serial monitor if monitor option is passed', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);
            mockGlobalConfig.boards.esp32 = {
                idfVersion: 'v5.4',
                rootDir: 'root/dir',
                exportFile: 'export/file.sh'
            }

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {monitor: true, port: '/tty/port1'});

            // --- Assert ---
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('idf.py build flash monitor'), {cwd: '/.bluescript/microcontroller/ports/esp32'});
        });
    });

    describe('Error Handling', () => {
        it('should exit with an error for an unknown board name', async () => {
            // --- Act ---
            await handleFlashRuntimeCommand('unknown-board', {});
            
            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to flash runtime to unknown-board');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unknown board.'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should handle errors during shell command execution', async () => {
            // --- Arrange ---
            mockIsBoardSetup.mockReturnValue(true);
            mockedExec.mockImplementation(async (command) => {
                if (command.includes('idf.py build flash')) {
                    throw new Error('flash failed');;
                }
                return '';
            });

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', { port: '/tty/port1' });

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to flash runtime to esp32');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(expect.any(Error));
            expect(process.exit).toHaveBeenCalledWith(1);
        });
    });
});