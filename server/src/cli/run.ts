import { logger } from "./utils";
import noble from '@abandonware/noble';
import * as fs from 'fs';
import { BSCRIPT_CONFIG_FILE_NAME } from "./constants";
import { z, ZodError } from 'zod';

const DEVICE_NAME = 'BLUESCRIPT';
const SERVICE_UUID = '00ff';
const CHARACTERISTIC_UUID = 'ff01';

const BsConfigSchema = z.object({
  name: z.string().min(1),
  device: z.object({
    kind: z.enum(['esp32', 'host']),
    name: z.string(),
  }),
});

type BsConfig = z.infer<typeof BsConfigSchema>;

export default async function run() {
    const bsConfig = readSettings();
    try {
        switch (bsConfig.device.kind) {
            case 'esp32':
                await runESP32();
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
}


function readSettings(): BsConfig {
    const configFilePath = `./${BSCRIPT_CONFIG_FILE_NAME}`;
    if (fs.existsSync(configFilePath)) {
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


async function runESP32(name: string = "BLUESCRIPT") {
    await new Promise<void>((resolve) => {
        noble.on('stateChange', (state) => {
        if (state === 'poweredOn') {
            resolve();
        }
        });
    });

    console.log('[Bluetooth] Start scanning...');
    await noble.startScanningAsync();

    noble.on('discover', async (peripheral) => {
        // デバイス名が一致するかチェック
        if (peripheral.advertisement.localName === DEVICE_NAME) {
            console.log(`[Found] Found target device: ${DEVICE_NAME}`);
            
            // スキャンを停止
            await noble.stopScanningAsync();
            
            try {
                // デバイスに接続
                console.log(`[Connect] Connecting to ${peripheral.address}...`);
                await peripheral.connectAsync();
                console.log('[Connect] Connected!');

                // サービスとキャラクタリスティックを発見
                const { services, characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
                    [SERVICE_UUID],
                    [CHARACTERISTIC_UUID]
                );
                
                console.log('[Discover] Discovered services and characteristics.');

                if (characteristics.length > 0) {
                    const targetCharacteristic = characteristics[0];
                    console.log(`[Characteristic] Found: ${targetCharacteristic.uuid}`);

                    // キャラクタリスティックからデータを読み取る
                    const data = await targetCharacteristic.readAsync();
                    
                    // データはBuffer形式で返ってくるので、適切に解釈する
                    // 例: 8ビット符号なし整数として読み取る
                    const value = data.readUInt8(0);
                    console.log(`[Read] Read data: ${data.toString('hex')}, Value: ${value}`);
                } else {
                    console.log('[Characteristic] Target characteristic not found.');
                }

                // デバイスから切断
                console.log('[Disconnect] Disconnecting...');
                await peripheral.disconnectAsync();
                console.log('[Disconnect] Disconnected.');
                
                // プログラムを終了
                process.exit(0);

            } catch (error) {
                console.error('[Error]', error);
                await peripheral.disconnectAsync();
                process.exit(1);
            }
        }
    });
}

