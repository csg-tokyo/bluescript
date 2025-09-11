import { getHostOSType, directoryExists, createDirectory, logger, executeCommand, deleteDirectory } from "./utils";
import * as CONSTANTS from './constants';
import { execSync } from "child_process";
import axios from 'axios';
import extract from 'extract-zip';
import * as fs from 'fs';


export default async function setup(device: string) {
    try {
        switch (device) {
            case 'esp32':
                await setupESP32();
                break;
            case 'host':
                logger.warn('Not implemented yet.');
                break;
            default:
                logger.warn('Unknown device.');
                break;
        }
    } catch (error) {
        logger.error('Failed to setup the project.');
        process.exit(1);
    }
}

async function setupESP32() {
    const osType = getHostOSType();
    try {
        if (osType === 'macos') {
            createDirectory(CONSTANTS.BSCRIPT_DIR, true);
            await installEspidfPrerequisitePackages();
            await setupEspidf();
            await downloadAndUnzipBlueScriptCode();
        } else {
            logger.warn("Not implemented yet.");
            return;
        }
    } catch (error) {
        logger.error('Failed to setup for esp32.');
        throw error;
    }
}

async function downloadAndUnzipBlueScriptCode() {
    logger.info('Downloading BlueScript code.');
    if (directoryExists(CONSTANTS.BSCRIPT_RUNTIME_DIR)) {
        logger.info(`Found existing ${CONSTANTS.BSCRIPT_RUNTIME_DIR}. Deleting...`);
        deleteDirectory(CONSTANTS.BSCRIPT_RUNTIME_DIR);
    }
    if (directoryExists(CONSTANTS.BSCRIPT_MODULES_DIR)) {
        logger.info(`Found existing ${CONSTANTS.BSCRIPT_MODULES_DIR}. Deleting...`);
        deleteDirectory(CONSTANTS.BSCRIPT_MODULES_DIR);
    }
    try {
        await downloadAndUnzip(CONSTANTS.BSCRIPT_RUNTIME_ZIP_URL, CONSTANTS.BSCRIPT_DIR);
        await downloadAndUnzip(CONSTANTS.BSCRIPT_MODULES_ZIP_URL, CONSTANTS.BSCRIPT_DIR);
    } catch (error) {
        throw error;
    }
}

async function installEspidfPrerequisitePackages() {
    logger.info('Installing prerequisite packages for ESP-IDF. This may take a while ...');
    if (isPackageInstalled('brew')) {
        logger.info(`Using brew to install packages.`);
        await installPackage('brew', 'cmake');
        await installPackage('brew', 'ninja');
        await installPackage('brew', 'dfu-util');
        await installPackage('brew', 'ccache');
    } else if (isPackageInstalled('port')) {
        logger.info(`Using port to install packages.`);
        await installPackage('port', 'cmake');
        await installPackage('port', 'ninja');
        await installPackage('port', 'dfu-util');
        await installPackage('port', 'ccache');
    } else {
        logger.error('Failed to install prerequisite packages. Please install Homebrew or MacPorts and try again.');
        throw new Error('No package manager found.');
    }
}

async function setupEspidf() {
    logger.info(`Start setting up ESP-IDF ${CONSTANTS.ESP_IDF_VERSION}.`);
    try {
        if (directoryExists(CONSTANTS.ESP_DIR)) {
            logger.info(`${CONSTANTS.ESP_DIR} already exists.`);
            logger.info(`Skip cloning ESP-IDF. If you don't want to skip this step, run 'bscript remove esp32'.`);
        } else {
            createDirectory(CONSTANTS.ESP_DIR, true);
            if (!isPackageInstalled('git')) {
                logger.error('Cannot find git command. Please install git.');
                throw new Error();
            }
            logger.info(`Cloning ESP-IDF ${CONSTANTS.ESP_IDF_VERSION}. This may take a while ...`);
            await executeCommand(`git clone -b ${CONSTANTS.ESP_IDF_VERSION} --recursive ${CONSTANTS.ESP_IDF_GIT_REPO}`, CONSTANTS.ESP_DIR);
        }
        logger.info(`Installing packages for ESP-IDF. This may take a while ...`);
        await executeCommand(`${CONSTANTS.ESP_DIR}/esp-idf/install.sh`);
        logger.success(`Setting up ESP-IDF was completed.`);
    } catch (error) {
        logger.error(`Failed to setup ESP-IDF ${CONSTANTS.ESP_IDF_VERSION}: ${error}`);
        throw error;
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
        throw error;
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
        logger.error(`Failed to install ${packageName} via ${packageManagerCommand}: ${error}`);
        throw error;
    }
}

