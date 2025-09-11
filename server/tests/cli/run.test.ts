import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

const mockFs = {
    existsSync: jest.fn<(path: string)=>boolean>(),
    readFileSync: jest.fn<(path: string)=>string>(),
};
jest.mock('fs', () => mockFs);

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    bsLog: jest.fn(),
    bsError: jest.fn(),
};
const mockUtils = {
    logger: mockLogger,
    directoryExists: jest.fn(),
    createDirectory: jest.fn(),
};
jest.mock('../../src/cli/utils', () => mockUtils);

const mockBleInstance = {
    connect: jest.fn<()=>Promise<void>>().mockResolvedValue(undefined),
    disconnect: jest.fn<()=>Promise<void>>().mockResolvedValue(undefined),
    startSubscribe: jest.fn<()=>Promise<void>>().mockResolvedValue(undefined),
    writeBuffers: jest.fn<(buffer: Buffer)=>Promise<void>>().mockResolvedValue(undefined),
    addTempNotificationHandler: jest.fn<(handler: (data: Buffer) => void)=>void>(),
    setNotificationHandler: jest.fn<(handler: (data: Buffer) => void)=>void>(),
    removeNotificationHanlder: jest.fn<()=>Promise<void>>(),
};
jest.mock('../../src/cli/ble', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockBleInstance),
    MAX_MTU: 495,
}));

const mockSessionInstance = {
    compile: jest.fn(),
};
jest.mock('../../src/server/session', () => {
    return jest.fn().mockImplementation(() => mockSessionInstance);
});

const mockBytecodeBufferGeneratorInstance = {
    reset: jest.fn().mockReturnThis(),
    load: jest.fn().mockReturnThis(),
    jump: jest.fn().mockReturnThis(),
    generate: jest.fn().mockReturnValue([Buffer.from('mock-bytecode')]),
};
jest.mock('../../src/cli/bytecode', () => ({
    ...jest.requireActual<{
        bytecodeParser: (data: Buffer) => ParseResult;
    }>('../../src/cli/bytecode'),
    BytecodeBufferGenerator: jest.fn().mockImplementation(() => mockBytecodeBufferGeneratorInstance),
}));


// --- Import target modules ---
import run from '../../src/cli/run';
import * as CONSTANTS from '../../src/cli/constants';
import { BYTECODE } from '../../src/cli/bytecode';
import Session from '../../src/server/session';
import BLE from '../../src/cli/ble';
import { ParseResult } from '../../src/cli/bytecode';
import { MemoryAddresses } from '../../src/compiler/shadow-memory';

// --- Test ---

describe('run.ts', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('run (main function)', () => {
        it('should execute ESP32 workflow when device kind is esp32', async () => {
            // Mock fs to simulate existing config and entry files
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((path: string) => {
                if (path.toString().endsWith(CONSTANTS.BSCRIPT_CONFIG_FILE_NAME)) {
                    return JSON.stringify({
                        name: 'TestProject',
                        device: { kind: 'esp32', name: 'TestESP32' },
                    });
                }
                if (path.toString().endsWith(CONSTANTS.BSCRIPT_ENTRY_FILE_NAME)) {
                    return 'let a = 1;';
                }
                 if (path.toString().endsWith(CONSTANTS.ESP_IDF_TOOL_JSON)) {
                    return JSON.stringify({ tools: [{ name: 'xtensa-esp-elf', versions: [{name: 'v1.2.3'}] }] });
                }
                return '';
            });

            // Mock BLE behaviors
            mockBleInstance.addTempNotificationHandler.mockImplementation((handler) => {
                const mockMemInfo = {
                    iram: { address: 0x1000, size: 0x2000 },
                    dram: { address: 0x3000, size: 0x4000 },
                    iflash: { address: 0x5000, size: 0x6000 },
                    dflash: { address: 0x7000, size: 0x8000 },
                }; 
                const buff = generateMemInfoBuffer(mockMemInfo);
                handler(buff);
            });
            mockBleInstance.setNotificationHandler.mockImplementation((handler) => {
                const execTimeBuff = Buffer.allocUnsafe(1 + 4 + 4);
                execTimeBuff.writeUInt8(BYTECODE.RESULT_EXECTIME, 0);
                execTimeBuff.writeInt32LE(-1, 1); // id
                execTimeBuff.writeFloatLE(123.45, 5); // exectime
                handler(execTimeBuff);
            });

            // Mock Session.compile to return a dummy compilation result
            const mockCompileResult = { result: { blocks: [], entryPoints: [] } };
            mockSessionInstance.compile.mockReturnValue(mockCompileResult);

            await run();

            expect(BLE).toHaveBeenCalledWith('TestESP32');
            expect(mockBleInstance.connect).toHaveBeenCalled();
            expect(mockSessionInstance.compile).toHaveBeenCalledWith('let a = 1;');
            expect(mockBleInstance.disconnect).toHaveBeenCalled();
            expect(mockProcessExit).toHaveBeenCalledWith(0);
        });

        it('should log a warning for "host" device', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                name: 'TestProject',
                device: { kind: 'host', name: 'MyPC' },
            }));

            await run();

            expect(mockLogger.warn).toHaveBeenCalledWith('Not impelented yet.');
            expect(mockProcessExit).toHaveBeenCalledWith(0);
        });

        it('should exit with error if reading settings fails', async () => {
            mockFs.existsSync.mockReturnValue(false); // Simulate missing config file

            await run();

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot find file'));
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to run the project.');
            expect(mockProcessExit).toHaveBeenCalledWith(1);
        });
    });

    describe('readSettings', () => {
        it('should throw an error for invalid Zod schema', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                name: 'InvalidConfig',
                // device object is missing
            }));

            await run();

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse'));
            expect(mockProcessExit).toHaveBeenCalledWith(1);
        });
    });
    
    describe('runESP32 workflow', () => {
        beforeEach(() => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((path) => {
                if (path.toString().endsWith(CONSTANTS.BSCRIPT_CONFIG_FILE_NAME)) {
                    return JSON.stringify({ name: 'TestProject', device: { kind: 'esp32', name: 'TestESP32' } });
                }
                if (path.toString().endsWith(CONSTANTS.BSCRIPT_ENTRY_FILE_NAME)) {
                    return 'let a = 1;';
                }
                 if (path.toString().endsWith(CONSTANTS.ESP_IDF_TOOL_JSON)) {
                    return JSON.stringify({ tools: [{ name: 'xtensa-esp-elf', versions: [{name: 'v1.2.3'}] }] });
                }
                return '';
            });
            mockSessionInstance.compile.mockReturnValue({ result: { blocks: [], entryPoints: [] } });
        });

        it('should initialize device and handle memory info response', async () => {
            const mockMemInfo = {
                iram: { address: 0x1000, size: 0x2000 },
                dram: { address: 0x3000, size: 0x4000 },
                iflash: { address: 0x5000, size: 0x6000 },
                dflash: { address: 0x7000, size: 0x8000 },
            };          
            mockBleInstance.addTempNotificationHandler.mockImplementation((handler) => {
                const buff = generateMemInfoBuffer(mockMemInfo);
                handler(buff);
            });

            await run();
            
            expect(mockBytecodeBufferGeneratorInstance.reset).toHaveBeenCalled();
            expect(mockBleInstance.writeBuffers).toHaveBeenCalled();
            expect(Session).toHaveBeenCalledWith(
                mockMemInfo,
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
            );
        });
        
        it('should handle logs and execution time from device', async () => {
            mockBleInstance.setNotificationHandler.mockImplementation((handler) => {
                const logBuff = Buffer.concat([
                    Buffer.from([BYTECODE.RESULT_LOG]),
                    Buffer.from('Hello from device!', 'utf-8'),
                    Buffer.from([0]),
                ]);
                handler(logBuff);
                const errorBuff = Buffer.concat([
                    Buffer.from([BYTECODE.RESULT_ERROR]),
                    Buffer.from('An error occurred.', 'utf-8'),
                ]);
                handler(errorBuff);
                const execTimeBuff = Buffer.allocUnsafe(1 + 4 + 4);
                execTimeBuff.writeUInt8(BYTECODE.RESULT_EXECTIME, 0);
                execTimeBuff.writeInt32LE(-1, 1); // id
                execTimeBuff.writeFloatLE(123.45, 5); // exectime
                handler(execTimeBuff);
            });
            
            await run();

            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Executing...'));
            expect(mockLogger.bsLog).toHaveBeenCalledWith('Hello from device!');
            expect(mockLogger.bsError).toHaveBeenCalledWith('An error occurred.');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Execution Time: 123.45 ms'));
            expect(mockBleInstance.removeNotificationHanlder).toHaveBeenCalled();
        });
        
        it('should throw if BLE connection fails', async () => {
            mockBleInstance.connect.mockRejectedValue(new Error('Connection failed'));
            
            await run();
            
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to run the project.');
            expect(mockProcessExit).toHaveBeenCalledWith(1);
        });
    });
});

function generateMemInfoBuffer(meminfo: MemoryAddresses): Buffer {
    const writeMemInfo = (buff: Buffer, offset: number, address: number, size: number) => {
        buff.writeUInt32LE(address, offset); offset += 4;
        buff.writeUInt32LE(size, offset); offset += 4;
        return offset;
    }
    const buff = Buffer.allocUnsafe(1 + (4 + 4) * 4);
    let offset = 0;
    buff.writeUInt8(BYTECODE.RESULT_MEMINFO, offset); offset += 1;
    offset = writeMemInfo(buff, offset, meminfo.iram.address, meminfo.iram.size);
    offset = writeMemInfo(buff, offset, meminfo.dram.address, meminfo.dram.size);
    offset = writeMemInfo(buff, offset, meminfo.iflash.address, meminfo.iflash.size);
    offset = writeMemInfo(buff, offset, meminfo.dflash.address, meminfo.dflash.size);
    return buff;
}
