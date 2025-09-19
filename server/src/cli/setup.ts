import { getHostOSType, logger, executeCommand } from "./utils";
import { execSync } from "child_process";
import axios from 'axios';
import extract from 'extract-zip';
import * as fs from 'fs';
import { ESP_IDF_PATH, GLOBAL_PATH, ZIP_URL } from "./path";


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
            fs.mkdirSync(GLOBAL_PATH.BSCRIPT_DIR(), {recursive: true});
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
    if (fs.existsSync(GLOBAL_PATH.RUNTIME_DIR())) {
        logger.info(`Found existing ${GLOBAL_PATH.RUNTIME_DIR()}. Deleting...`);
        fs.rmSync(GLOBAL_PATH.RUNTIME_DIR(), { recursive: true, force: true });
    }
    if (fs.existsSync(GLOBAL_PATH.PACKAGES_DIR())) {
        logger.info(`Found existing ${GLOBAL_PATH.PACKAGES_DIR()}. Deleting...`);
        fs.rmSync(GLOBAL_PATH.PACKAGES_DIR(), { recursive: true, force: true });
    }
    try {
        const version = 'v1.1.4';
        await downloadAndUnzip(ZIP_URL.RUNTIME(version), GLOBAL_PATH.BSCRIPT_DIR());
        await downloadAndUnzip(ZIP_URL.PACKAGES(version), GLOBAL_PATH.BSCRIPT_DIR());
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
    const version = ESP_IDF_PATH.VERSION;
    const root = ESP_IDF_PATH.ROOT();
    logger.info(`Start setting up ESP-IDF ${version}.`);
    try {
        if (fs.existsSync(root)) {
            logger.info(`${root} already exists.`);
            logger.info(`Skip cloning ESP-IDF. If you don't want to skip this step, run 'bscript remove esp32'.`);
        } else {
            fs.mkdirSync(root, {recursive: true});
            if (!isPackageInstalled('git')) {
                logger.error('Cannot find git command. Please install git.');
                throw new Error();
            }
            logger.info(`Cloning ESP-IDF ${version}. This may take a while ...`);
            await executeCommand(`git clone -b ${version} --recursive ${ESP_IDF_PATH.GIT_REPO}`, root);
        }
        logger.info(`Installing packages for ESP-IDF. This may take a while ...`);
        await executeCommand(ESP_IDF_PATH.INSTALL_FILE());
        logger.success(`Setting up ESP-IDF was completed.`);
    } catch (error) {
        logger.error(`Failed to setup ESP-IDF ${version}: ${error}`);
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

