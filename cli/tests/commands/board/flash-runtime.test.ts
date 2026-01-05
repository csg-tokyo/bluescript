import { handleFlashRuntimeCommand } from '../../../src/commands/board/flash-runtime';
import { SerialPort } from 'serialport';
import { deleteGlobalEnv, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32, spyGlobalSettings } from '../global-env-helper';
import {
    mockedInquirer,
    mockedLogger,
    mockedShowErrorMessages,
    mockProcessExit,
    mockedExec,
} from '../mock-helpers';


jest.mock('serialport');
const mockedSerialPort = SerialPort as jest.Mocked<typeof SerialPort>;
const portList = [{
    path: '/tty/port1',
    manufacturer: undefined, 
    serialNumber: undefined, 
    pnpId: undefined,
    locationId: undefined, 
    productId: undefined, 
    vendorId: undefined
}];

describe('board flash-runtime command', () => {
    beforeAll(() => {
        spyGlobalSettings('flash');
    });

    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
    });

    it('should show warning and exit if update is needed', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv(true);

        // --- Act ---
        await handleFlashRuntimeCommand('esp32', { port: '/tty/port1' });

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should not show prompt if port is specified', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();

        // --- Act ---
        await handleFlashRuntimeCommand('esp32', { port: '/tty/port1' });

        // --- Assert ---
        expect(mockedInquirer.prompt).not.toHaveBeenCalled();
        expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('idf.py build flash -p'), {cwd: expect.stringContaining('esp32')});
    });

    it('should show an error and return if no serial ports are found', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        mockedSerialPort.list.mockResolvedValue([]);

        // --- Act ---
        await handleFlashRuntimeCommand('esp32', {});

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalled();
        expect(mockedInquirer.prompt).not.toHaveBeenCalled();
        expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should exit with an error for an unknown board name', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        const exitSpy = mockProcessExit();
        
        // --- Act ---
        await handleFlashRuntimeCommand('unknown-board', {});
        
        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to flash the runtime to unknown-board');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    describe('for esp32 board', () => {
        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should flash runtime to board if setup for esp32 exists', async () => {
            // --- Arrange ---
            setupGlobalEnvWithEsp32();
            mockedSerialPort.list.mockResolvedValue(portList);
            mockedInquirer.prompt.mockResolvedValue({port: '/tty/port1'});

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedExec).toHaveBeenCalledWith(expect.stringContaining('idf.py build flash -p'), {cwd: expect.stringContaining('esp32')});
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should warn and exit if setup is not completed', async () => {
            // --- Arrange ---
            setupDefaultGlobalEnv();

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith(`The environment for esp32 is not set up. Run 'bscript board setup esp32' and try again.`);
            expect(mockedInquirer.prompt).not.toHaveBeenCalled();
            expect(mockedExec).not.toHaveBeenCalled();
        });
    });
});