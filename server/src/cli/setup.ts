import { getHostOSType, directoryExists, createDirectory, logger, executeCommand, deleteDirectory } from "./utils";
import * as CONSTANTS from './constants';
import { execSync } from "child_process";
import axios from 'axios';
import extract from 'extract-zip'; 
import * as fs from 'fs';

const ESP_IDF_VERSION = 'v5.4'
const ESP_IDF_GIT_REPO = 'https://github.com/espressif/esp-idf.git'

export default async function setup(device: string) {
    switch (device) {
        case 'esp32':
            await setupESP32();
            break;
        case 'host':
            logger.warn('Not impelented yet.');
            break;
        default:
            logger.warn('Unknown device.');
            break;
    }
}

async function setupESP32() {
    const osType = getHostOSType();
    try {
        if (osType === 'macos') {
            createDirectory(CONSTANTS.BSCRIPT_DIR, true);
            await installEspidfPrerequisitePakages();
            await setupEspidf();
            await downloadAndUnzipBlueScriptCode();
        } else {
            logger.warn("Not implemented yet.");
            return;
        }
    } catch (error) {
        logger.error('Failed to setup for esp32.');
        process.exit(1);
    }
}

async function downloadAndUnzipBlueScriptCode() {
    logger.info('Downloading BlueScript code.');
    if (directoryExists(CONSTANTS.BSCRIPT_FIRMWARE_DIR)) {
        logger.info(`Found existing ${CONSTANTS.BSCRIPT_FIRMWARE_DIR}. Deleting...`);
        deleteDirectory(CONSTANTS.BSCRIPT_FIRMWARE_DIR);
    }
    if (directoryExists(CONSTANTS.BSCRIPT_MODULES_DIR)) {
        logger.info(`Found existing ${CONSTANTS.BSCRIPT_MODULES_DIR}. Deleting...`);
        deleteDirectory(CONSTANTS.BSCRIPT_MODULES_DIR);
    }
    try {
        await downloadAndUnzip(CONSTANTS.BSCRIPT_FIRMWARE_ZIP_URL, CONSTANTS.BSCRIPT_DIR);
        await downloadAndUnzip(CONSTANTS.BSCRIPT_MODULES_ZIP_URL, CONSTANTS.BSCRIPT_DIR);
    } catch (error) {
        throw new Error();
    }
}

async function installEspidfPrerequisitePakages() {
    logger.info('Installing prerequisite packages for ESP-IDF. This may take a while ...');
    if (isPackageInstalled('brew')) {
        await installPackage('brew', 'cmake');
        await installPackage('brew', 'ninja');
        await installPackage('brew', 'dfu-util');
        await installPackage('brew', 'ccache');
    } else if (isPackageInstalled('port')) {
        await installPackage('port', 'cmake');
        await installPackage('port', 'ninja');
        await installPackage('port', 'dfu-util');
        await installPackage('port', 'ccache');  
    } else {
        logger.error('Failed to install prerequisite packages. Please setup Homebrew or MacPorts and try again.');
        throw new Error();
    }
}

async function setupEspidf() {
    logger.info(`Start setting up ESP-IDF ${ESP_IDF_VERSION}.`);
    try {
        if (directoryExists(CONSTANTS.ESP32_DIR)) {
            logger.info(`${CONSTANTS.ESP32_DIR} already exists.`);
            logger.info(`Skip cloning ESP-IDF. If you don't want to skip this step, run 'bscript remove esp32'.`);
        } else {
            createDirectory(CONSTANTS.ESP32_DIR, true);
            if (!isPackageInstalled('git')) {
                logger.error('Cannot find git command. Please install git.');
                throw new Error();
            }
            logger.info(`Cloning ESP-IDF ${ESP_IDF_VERSION}. This may take a while ...`);
            await executeCommand(`git clone -b ${ESP_IDF_VERSION} --recursive ${ESP_IDF_GIT_REPO}`, CONSTANTS.ESP32_DIR);
        }
        logger.info(`Installing packages for ESP-IDF. This may take a while ...`);
        await executeCommand(`${CONSTANTS.ESP32_DIR}/esp-idf/install.sh`);
        logger.success(`Setting up ESP-IDF was completed.`);
    } catch (error) {
        logger.error(`Failed to setup ESP-IDF ${ESP_IDF_VERSION}`);
        throw new Error();
    }
}

async function downloadAndUnzip(url: string, outputDir: string) {
    logger.info(`Downloading zip from ${url}.`);
    const tmpZipPath = `${outputDir}/tmp.zip`;
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
        });
        const zipBuffer = Buffer.from(response.data);
        fs.writeFileSync(tmpZipPath, zipBuffer);
        await extract(tmpZipPath, { dir: outputDir });
        fs.rmSync(tmpZipPath);
        logger.success(`Successfully downloaded and extracted to ${outputDir}.`);
    } catch (error) {
        logger.error(`Failed to download and unzip: ${error}.`);
        throw new Error();
    }
}

function isPackageInstalled(name: string) {
    try {
        execSync(`which ${name}`, { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

async function installPackage(packageManagerCommand: string, packageName: string) {
    if (isPackageInstalled(packageName)) {
        logger.info(`Installing ${packageName} --skipped`);
        return;
    }
    logger.info(`Installing ${packageName} via ${packageManagerCommand} ...`);
    try {
        await executeCommand(`${packageManagerCommand} install ${packageName}`);
        logger.success(`The installation of ${packageName} was completed.`)
    } catch (error) {
        logger.error(`Failed to install ${packageName} via ${packageManagerCommand}.`);
        throw new Error();
    }
}

