import { handleFlashRuntimeCommand } from '../../../src/commands/board/flash-runtime';
import { SerialPort } from 'serialport';
import {
    mockedInquirer,
    mockedLogger,
    mockedShowErrorMessages,
    setupMocks,
    mockProcessExit,
    mockedExec,
} from '../mock-helpers';

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
    let mockGlobalConfigHandler: ReturnType<typeof setupMocks>['globalConfigHandler'];

    beforeEach(() => {
        const mocks = setupMocks();
        mockGlobalConfigHandler = mocks.globalConfigHandler;
        exitSpy = mockProcessExit();
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    describe('for esp32 board', () => {
        it('should flash runtime to board if setup for esp32 exists', async () => {
            // --- Arrange ---
            mockGlobalConfigHandler.isBoardSetup.mockReturnValue(true);
            mockGlobalConfigHandler.getConfig.mockReturnValue({
                runtimeDir: '/.bluescript/microcontroller'
            });
            mockGlobalConfigHandler.getBoardConfig.mockReturnValue({});
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
            mockGlobalConfigHandler.isBoardSetup.mockReturnValue(false);

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith(`The environment for esp32 is not set up. Run 'bscript board setup esp32' and try again.`);
            // No further actions taken
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).not.toHaveBeenCalled();
        });

        it('should not show prompt if port is specified', async () => {
            // --- Arrange ---
            mockGlobalConfigHandler.isBoardSetup.mockReturnValue(true);
            mockGlobalConfigHandler.getConfig.mockReturnValue({
                runtimeDir: '/.bluescript/microcontroller'
            });
            mockGlobalConfigHandler.getBoardConfig.mockReturnValue({});

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', { port: '/tty/port1' });

            // --- Assert ---
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).toHaveBeenCalled();
        });

        it('should show an error and exit if no serial ports are found', async () => {
            // --- Arrange ---
            mockGlobalConfigHandler.isBoardSetup.mockReturnValue(true);
            mockedSerialPort.list.mockResolvedValue([]);

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should exit with an error for an unknown board name', async () => {
            // --- Act ---
            await handleFlashRuntimeCommand('unknown-board', {});
            
            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to flash runtime to unknown-board');
            expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it('should handle errors during shell command execution', async () => {
            // --- Arrange ---
            mockGlobalConfigHandler.isBoardSetup.mockReturnValue(true);
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