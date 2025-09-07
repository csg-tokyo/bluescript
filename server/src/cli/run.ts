import { logger } from "./utils";
import * as fs from 'fs';
import { BSCRIPT_CONFIG_FILE_NAME, BSCRIPT_ENTRY_FILE_NAME } from "./constants";
import { z, ZodError } from 'zod';
import BLE, {MAX_MTU} from "./ble";
import { BYTECODE, BytecodeBufferGenerator, bytecodeParser } from "./bytecode";
import { MemoryAddresses } from "../compiler/shadow-memory";
import Session from "../server/session";

const BsConfigSchema = z.object({
  name: z.string().min(1),
  device: z.object({
    kind: z.enum(['esp32', 'host']),
    name: z.string(),
  }),
});

type BsConfig = z.infer<typeof BsConfigSchema>;

export default async function run() {
    try {
        const bsConfig = readSettings();
        switch (bsConfig.device.kind) {
            case 'esp32':
                await runESP32(bsConfig.device.name);
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
    const configFilePath = `./${BSCRIPT_CONFIG_FILE_NAME}`;
    if (!fs.existsSync(configFilePath)) {
        logger.error(`Cannot find file ${configFilePath}.`);
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
        throw new Error();
    }
}

async function runESP32(deviceName: string) {
    const entryFilePath = `./${BSCRIPT_ENTRY_FILE_NAME}`;
    try {
        const bsSrc = fs.readFileSync(entryFilePath, 'utf-8');
        const ble = new BLE(deviceName);
        await ble.connect();
        await ble.startSubscribe();
        const addresses = await initDevice(ble);

        console.log(addresses);
        await ble.disconnect();
    } catch(error) {
        throw new Error();
    }
    
    // compile
    // send
    // monitor
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
        throw new Error()
    }
}

function compile(bsSrc: string, addresses: MemoryAddresses) {
    const session = new Session(addresses);
    
}
