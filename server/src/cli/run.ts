import { createDirectory, directoryExists, logger } from "./utils";
import * as fs from 'fs';
import * as CONSTANTS from './constants';
import { z, ZodError } from 'zod';
import BLE, {MAX_MTU} from "./ble";
import { BYTECODE, BytecodeBufferGenerator, bytecodeParser } from "./bytecode";
import { MemoryAddresses, MemoryUpdate } from "../compiler/shadow-memory";
import Session from "../server/session";

const BsConfigSchema = z.object({
  name: z.string().min(1),
  device: z.object({
    kind: z.enum(['esp32', 'host']),
    name: z.string(),
  }),
  runtimeDir: z.string().optional(),
  modulesDir: z.string().optional()
});

type BsConfig = z.infer<typeof BsConfigSchema>;

export default async function run() {
    try {
        const bsConfig = readSettings();
        switch (bsConfig.device.kind) {
            case 'esp32':
                await runESP32(bsConfig);
                break;
            case 'host':
                logger.warn('Not impelented yet.');
                break;
            default:
                logger.warn('Unknown device.');
                break;
        }
    } catch (error) {
        logger.error('Failed to run the project.');
        process.exit(1);
    }
    process.exit(0);
}


function readSettings(): BsConfig {
    const configFilePath = `./${CONSTANTS.BSCRIPT_CONFIG_FILE_NAME}`;
    if (!fs.existsSync(configFilePath)) {
        logger.error(`Cannot find file ${configFilePath}. Run 'create-project' command.`);
        throw new Error();
    }
    try {
        const fileContent = fs.readFileSync(configFilePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        return BsConfigSchema.parse(jsonData);
    } catch (error) {
        if (error instanceof ZodError) {
            logger.error(`Failed to parse ${configFilePath}: ${z.treeifyError(error)}`)
        } else {
            logger.error(`Failed to read ${configFilePath}.`);
        }
        throw error;
    }
}

async function runESP32(bsConfig: BsConfig) {
    const entryFilePath = `./${CONSTANTS.BSCRIPT_ENTRY_FILE_NAME}`;
    try {
        const bsSrc = fs.readFileSync(entryFilePath, 'utf-8');
        const ble = new BLE(bsConfig.device.name);
        await ble.connect();
        await ble.startSubscribe();
        const addresses = await initDevice(ble);
        const compileResult = compile(addresses, bsSrc, bsConfig);
        await sendAndExecute(compileResult, ble);
        await ble.disconnect();
    } catch(error) {
        throw error;
    }
}

async function initDevice(ble: BLE): Promise<MemoryAddresses> {
    logger.info('Initializing device...')
    const buffs = new BytecodeBufferGenerator(MAX_MTU).reset().generate();
    try {
        await ble.writeBuffers(buffs);
        const addresses = await new Promise<MemoryAddresses>((resolve, reject) => {
            try {
                ble.addTempNotificationHandler((data) => {
                    const parseResult = bytecodeParser(data);
                    if (parseResult.bytecode === BYTECODE.RESULT_MEMINFO) {
                        resolve(parseResult.meminfo);
                    }
                });
            } catch (error) {
                logger.error(`Failed to receive memory addresses. ${error}`);
                reject()
            }
        });
        return addresses;
    } catch (error) {
        logger.error('Failed to initialize.');
        throw error;
    }
}

function compile(addresses: MemoryAddresses, bsSrc: string, bsConfig: BsConfig):MemoryUpdate {
    logger.info('Compiling...');
    try {
        const buildDir = `./${CONSTANTS.BSCRIPT_BUILD_DIR}`;
        if (!directoryExists(buildDir)) {
            createDirectory(buildDir, true);
        }
        const session = new Session(
            addresses,
            buildDir,
            bsConfig.modulesDir ?? CONSTANTS.BSCRIPT_MODULES_DIR,
            bsConfig.runtimeDir ?? CONSTANTS.BSCRIPT_RUNTIME_DIR,
            getCompilerDir()
        );
        const compileResult = session.compile(bsSrc);
        return compileResult.result;
    } catch (error) {
        logger.error(`Failed to compile: ${error}`);
        throw error;
    }
}

function getCompilerDir():string {
    try {
        const fileContent = fs.readFileSync(CONSTANTS.ESP_IDF_TOOL_JSON, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        const xtensaEspElfVersion = jsonData.tools.find((t:any) => t.name === 'xtensa-esp-elf').versions[0].name;
        return CONSTANTS.COMPILER_DIR(xtensaEspElfVersion);
    } catch (error) {
        logger.error(`Faild to read ${CONSTANTS.ESP_IDF_TOOL_JSON}: ${error}`);
        throw error;
    }
}

async function sendAndExecute(compileResult: MemoryUpdate, ble: BLE): Promise<void> {
    logger.info("Sending...");
    const bytecodeGenerator = new BytecodeBufferGenerator(MAX_MTU);
    for (const block of compileResult.blocks) {
        bytecodeGenerator.load(block.address, Buffer.from(block.data, "hex"));
    }
    for (const entryPoint of compileResult.entryPoints) {
        bytecodeGenerator.jump(entryPoint.id, entryPoint.address);
    }
    try {
        const buffs = bytecodeGenerator.generate();
        const buffLength = buffs.reduce((sum, buf) => sum + buf.length, 0);
        const startSending = performance.now();
        await ble.writeBuffers(buffs);
        logger.info(`Sent ${buffLength} bytes in ${Math.round((performance.now() - startSending) * 100) / 100} ms.`);
    } catch (error) {
        logger.error(`Faild to send code: ${error}`);
        throw error;
    }

    logger.info('Executing...');
    try {
        const executionTime = await new Promise<number>((resolve, reject) => {
            try {
                ble.setNotificationHandler((data) => {
                    const parseResult = bytecodeParser(data);
                    if (parseResult.bytecode === BYTECODE.RESULT_EXECTIME) {
                        resolve(parseResult.exectime);
                    } else if (parseResult.bytecode === BYTECODE.RESULT_LOG) {
                        logger.bsLog(parseResult.log);
                    } else if (parseResult.bytecode === BYTECODE.RESULT_ERROR) {
                        logger.bsError(parseResult.error);
                    }
                });
            } catch (error) {
                logger.error(`Failed to receive execution time: ${error}`);
                reject();
            }
        });
        logger.info(`Execution Time: ${Math.round(executionTime * 100) / 100} ms`);
        ble.removeNotificationHanlder();
    } catch (error) {
        logger.error(`Failed to execute code: ${error}`);
        throw error;
    }
}
