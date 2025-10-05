import { logger, readBsConfig, BsConfig} from "./utils";
import BLE, {MAX_MTU} from "./ble";
import { BYTECODE, BytecodeBufferGenerator, bytecodeParser } from "./bytecode";
import { ESP_IDF_PATH, GLOBAL_PATH, PACKAGE_PATH } from "./path";
import { Compiler, CompilerConfig, ExecutableBinary, MemoryLayout, PackageConfig } from "@bluescript/compiler";


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
        logger.error(`Failed to run the project: ${error}`);
        process.exit(1);
    }
    process.exit(0);
}

async function runESP32(bsConfig: BsConfig) {
    try {
        // TODO: flashが終わっているかの確認を入れる。
        const ble = new BLE(bsConfig.device.name);
        await ble.connect();
        await ble.startSubscribe();
        const memoryLayout = await initDevice(ble);
        const executableBinary = await compile(bsConfig, memoryLayout);
        await sendAndExecute(ble, executableBinary);
        await ble.disconnect();
    } catch(error) {
        throw error;
    }
}

async function initDevice(ble: BLE): Promise<MemoryLayout> {
    logger.info('Initializing device...')
    const buffs = new BytecodeBufferGenerator(MAX_MTU).reset().generate();
    try {
        await ble.writeBuffers(buffs);
        const memoryLayout = await new Promise<MemoryLayout>((resolve, reject) => {
            try {
                ble.addTempNotificationHandler((data) => {
                    const parseResult = bytecodeParser(data);
                    if (parseResult.bytecode === BYTECODE.RESULT_MEMINFO) {
                        resolve(parseResult.meminfo);
                    }
                });
            } catch (error) {
                logger.error(`Failed to receive memory layout. ${error}`);
                reject()
            }
        });
        return memoryLayout;
    } catch (error) {
        logger.error('Failed to initialize.');
        throw error;
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

async function sendAndExecute(ble: BLE, executableBinary: ExecutableBinary) {
    logger.info("Sending...");
    const bytecodeGenerator = new BytecodeBufferGenerator(MAX_MTU)
    if (executableBinary.iram) bytecodeGenerator.load(executableBinary.iram.address, executableBinary.iram.data);
    if (executableBinary.dram) bytecodeGenerator.load(executableBinary.dram.address, executableBinary.dram.data);
    if (executableBinary.iflash) bytecodeGenerator.load(executableBinary.iflash.address, executableBinary.iflash.data);
    if (executableBinary.dflash) bytecodeGenerator.load(executableBinary.dflash.address, executableBinary.dflash.data);
    for (const entryPoint of executableBinary.entryPoints) {
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
                    if (parseResult.bytecode === BYTECODE.RESULT_EXECTIME && parseResult.id >= 0) {
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
