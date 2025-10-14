import { logger, readBsConfig, BsConfig} from "./utils";
import { ESP_IDF_PATH, GLOBAL_PATH, PACKAGE_PATH } from "./path";
import { Compiler, CompilerConfig, ExecutableBinary, MemoryLayout, PackageConfig } from "@bluescript/compiler";
import { BleConnection } from "../services/ble";


export default async function run() {
    try {
            const bsConfig = readBsConfig(PACKAGE_PATH.BSCONFIG_FILE('./'));
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
            logger.error(`Failed to run the project.`);
            process.exit(1);
        }
}

async function runESP32(bsConfig: BsConfig) {
    const ble = new BleConnection(bsConfig.device.name);
    await ble.connect();
    ble.on('disconnected', () => {
        logger.error("BLE disconnected");
    });
    const deviceService = ble.getService('device');
    deviceService.on('log', (message) => {
        logger.bsLog(message);
    });
    deviceService.on('error', (message) => {
        logger.bsError(message);
    })
    const memoryLayout = await deviceService.init();
    try {
        const bin = await compile(bsConfig, memoryLayout);
        const exectime = await deviceService.execute(bin);

    } catch (error) {
        console.log(error);
    }
}

async function compile(bsConfig: BsConfig, memoryLayout: MemoryLayout): Promise<ExecutableBinary> {
    logger.info('Compiling...');
    const compilerConfig = getCompilerConfig(bsConfig);
    const compiler = new Compiler(memoryLayout, compilerConfig, packageReader);
    return await compiler.compile();
}

function getCompilerConfig(bsConfig: BsConfig): CompilerConfig {
    return {
        dirs: {
            runtime: bsConfig.dirs?.runtime ?? GLOBAL_PATH.RUNTIME_DIR(),
            compilerToolchain: ESP_IDF_PATH.XTENSA_GCC_DIR(),
            std: PACKAGE_PATH.SUB_PACKAGE_DIR(bsConfig.dirs?.packages ?? GLOBAL_PATH.PACKAGES_DIR(), 'std'),
        }
    }
}

function packageReader(packageName: string): PackageConfig {
    const cwd = process.cwd();
    const packageRoot = packageName === 'main' ? cwd : PACKAGE_PATH.SUB_PACKAGE_DIR(PACKAGE_PATH.LOCAL_PACKAGES_DIR(cwd), packageName);
    try {
        const bsConfig = readBsConfig(PACKAGE_PATH.BSCONFIG_FILE(packageRoot));
        return {
            name: packageName,
            espIdfComponents: bsConfig.espIdfComponents ?? [],
            dependencies: bsConfig.dependencies ?? [],
            dirs: {
                root: packageRoot,
                dist: PACKAGE_PATH.DIST_DIR(packageRoot),
                build: PACKAGE_PATH.BUILD_DIR(packageRoot),
                packages: PACKAGE_PATH.LOCAL_PACKAGES_DIR(packageRoot)
            }
        }
    } catch (error) {
        throw new Error(`Faild to read ${packageName}: ${error?.toString()}`);
    }
}