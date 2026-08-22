import { formatPortChoiceLabel, handleFlashRuntimeCommand } from '../../../src/commands/board/flash-runtime';
import { SerialPort } from 'serialport';
import { deleteGlobalEnv, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32, setupGlobalEnvWithHost, spyGlobalSettings } from '../global-env-helper';
import {
    mockedInquirer,
    mockedLogger,
    mockProcessExit,
    mockedExecShell,
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

describe('formatPortChoiceLabel', () => {
    it('formats path and manufacturer when ids are missing', () => {
        expect(formatPortChoiceLabel({ path: '/dev/ttyUSB0' })).toBe('/dev/ttyUSB0 — N/A');
        expect(formatPortChoiceLabel({
            path: 'COM3',
            manufacturer: 'Espressif',
        })).toBe('COM3 — Espressif');
    });

    it('appends vid:pid when present', () => {
        expect(formatPortChoiceLabel({
            path: '/dev/tty.usbserial-0001',
            manufacturer: 'Silicon Labs',
            vendorId: '10C4',
            productId: 'EA60',
        })).toBe('/dev/tty.usbserial-0001 — Silicon Labs (10c4:ea60)');
    });

    it('omits vid:pid when absent', () => {
        expect(formatPortChoiceLabel({
            path: '/dev/ttyUSB0',
            manufacturer: undefined,
            vendorId: '1A86',
            productId: '7523',
        })).toBe('/dev/ttyUSB0 — N/A (1a86:7523)');
    });
});

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
        expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('build flash -p'), { cwd: expect.stringContaining('esp32') });
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
        expect(mockedExecShell).not.toHaveBeenCalled();
    });

    it('should exit with an error for an unknown board name', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        const exitSpy = mockProcessExit();
        
        // --- Act ---
        await handleFlashRuntimeCommand('unknown-board', {});
        
        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to flash the runtime to unknown-board');
        expect(mockedLogger.showError).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
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
            const richPortList = [{
                path: '/dev/tty.usbserial-0001',
                manufacturer: 'Silicon Labs',
                serialNumber: '0001',
                pnpId: undefined,
                locationId: undefined,
                productId: 'EA60',
                vendorId: '10C4',
            }];
            mockedSerialPort.list.mockResolvedValue(richPortList);
            mockedInquirer.prompt.mockResolvedValue({port: '/dev/tty.usbserial-0001'});

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedInquirer.prompt).toHaveBeenCalledWith([
                expect.objectContaining({
                    choices: [{
                        name: '/dev/tty.usbserial-0001 — Silicon Labs (10c4:ea60)',
                        value: '/dev/tty.usbserial-0001',
                    }],
                }),
            ]);
            expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('build flash'), { cwd: expect.stringContaining('esp32') });
            expect(mockedLogger.error).not.toHaveBeenCalled();
        });

        it('should flash runtime to board with device name if specified', async () => {
            // --- Arrange ---
            setupGlobalEnvWithEsp32();
            mockedSerialPort.list.mockResolvedValue(portList);
            mockedInquirer.prompt.mockResolvedValue({port: '/tty/port1'});

            // --- Act ---
            await handleFlashRuntimeCommand('esp32', { deviceName: 'my-device' });

            // --- Assert ---
            expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('my-device'), { cwd: expect.stringContaining('esp32') });
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
            expect(mockedExecShell).not.toHaveBeenCalled();
        });
    });

    describe('for host board', () => {
        it('should exit with an error because flash-runtime is not supported', async () => {
            setupGlobalEnvWithHost();
            const exitSpy = mockProcessExit();

            await handleFlashRuntimeCommand('host', {});

            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to flash the runtime to host');
            expect(mockedLogger.showError).toHaveBeenCalledWith(
                new Error('flash-runtime is not supported for the host board'),
            );
            expect(process.exit).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });
    });
});
