import { SetupHandler } from "./base";
import { execShell, execWithLog } from '../../../core/command-exec';
import { skip } from "../../../core/logger";
import * as path from 'path';
import * as nodeFs from 'fs';
import * as fs from '../../../core/fs';
import { BoardName } from "../../../config/board-utils";
import { Esp32UnixEnv, Esp32WindowsEnv } from "../../../platforms/board-env/esp32-env";
import { GLOBAL_SETTINGS } from "../../../config/constants";


export class Esp32DarwinSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32UnixEnv;
    pythonCommand?: string;
    makeCommand?: string;

    constructor() {
        super();
        this.boardEnv = new Esp32UnixEnv();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: "Verify that git, python3, brew and make are installed.",
            actionMessage: "Verifying that git, python3 and brew are installed...",
            action: this.verifyPrerequisitsInstalledStep.bind(this),
        });
        this.setupSteps.push({
            description: "Install required packages via brew if they are not installed (cmake, ninja, dfu-util, and ccache).",
            actionMessage: "Installing required packages...",
            action: this.installRequiredPackagesStep.bind(this),
        });
        this.setupSteps.push({
            description: `Clone ESP-IDF ${this.boardEnv.idfVersion} from ${this.boardEnv.idfGitRepo}.`,
            actionMessage: `Cloning ESP-IDF ${this.boardEnv.idfVersion}... It may take a while.`,
            action: this.cloneEspIdfStep.bind(this),
        });
        this.setupSteps.push({
            description: "Run ESP-IDF install script.",
            actionMessage: "Running ESP-IDF install script...",
            action: this.runEspIdfInstallScriptStep.bind(this),
        });
    }

    async setBoardConfig() {
        const xtensaGccDir = await this.boardEnv.getXtensaGccDir(this.pythonCommand!);
        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: this.boardEnv.idfVersion,
            rootDir: this.boardEnv.espRootDir,
            exportFile: this.boardEnv.idfExportFile,
            toolchain: {
                gcc: path.join(xtensaGccDir, this.boardEnv.xtensaGccFileName),
                ar: path.join(xtensaGccDir, this.boardEnv.xtensaArFileName),
                ld: path.join(xtensaGccDir, this.boardEnv.xtensaLdFileName),
                make: this.makeCommand!,
                python: this.pythonCommand!
            },
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        if (!await this.boardEnv.isPackageInstalled("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        if (!await this.boardEnv.isPackageInstalled("brew")) {
            throw new Error("Cannot find brew command. Please install Homebrew and try again.");
        }
        this.pythonCommand = await this.boardEnv.getPythonCommand();
        this.makeCommand = await this.boardEnv.getMakeCommand();
    }

    private async installRequiredPackagesStep() {
        let packages: string[] = [];
        if (!(await this.boardEnv.isPackageInstalled('cmake'))) { packages.push('cmake'); }
        if (!(await this.boardEnv.isPackageInstalled('ninja'))) { packages.push('ninja'); }
        if (!(await this.boardEnv.isPackageInstalled('dfu-util'))) { packages.push('dfu-util'); }
        if (!(await this.boardEnv.isPackageInstalled('ccache'))) { packages.push('ccache'); }
        if (packages.length === 0) {
            return skip('already installed.');
        }
        await execWithLog('brew', ['install', ...packages]);
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
    }
}

export class Esp32LinuxSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32UnixEnv;
    distType: 'UbuntuDebian' | 'CentOS7or8' | 'Arch';
    ruleFile: string = '/etc/udev/rules.d/bscript-serial.rules';
    nodeBleCapabilities = 'cap_net_raw,cap_net_admin+eip';

    get requiredPackages() {
        if (this.distType === 'UbuntuDebian') {
            return ['make', 'git', 'wget', 'flex', 'bison', 'gperf', 'python3', 'python3-pip', 'python3-venv', 'cmake', 'ninja-build', 'ccache', 'libffi-dev', 'libssl-dev', 'dfu-util', 'libusb-1.0-0', 'libcap2-bin'];
        } else if (this.distType === 'CentOS7or8') {
            return ['make', 'git', 'wget', 'flex', 'bison', 'gperf', 'python3', 'cmake', 'ninja-build', 'ccache', 'dfu-util', 'libusbx', 'libcap'];
        } else { // Arch
            return ['gcc', 'git', 'make', 'flex', 'bison', 'gperf', 'python', 'cmake', 'ninja', 'ccache', 'dfu-util', 'libusb', 'libcap'];
        }
    }

    constructor() {
        super();
        this.boardEnv = new Esp32UnixEnv();
        this.distType = this.getDistribution();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: `Install required packages (${this.requiredPackages.join(', ')}), if needed.`,
            actionMessage: "Installing required packages...",
            action: this.installRequiredPackagesStep.bind(this),
        });
        this.setupSteps.push({
            description: `Clone ESP-IDF ${this.boardEnv.idfVersion} from ${this.boardEnv.idfGitRepo}.`,
            actionMessage: `Cloning ESP-IDF ${this.boardEnv.idfVersion}... It may take a while.`,
            action: this.cloneEspIdfStep.bind(this),
        });
        this.setupSteps.push({
            description: "Run ESP-IDF install script.",
            actionMessage: "Running ESP-IDF install script...",
            action: this.runEspIdfInstallScriptStep.bind(this),
        });
        this.setupSteps.push({
            description: `Write ${this.ruleFile} to configure access permissions for the serial device.`,
            actionMessage: `Writing ${this.ruleFile}...`,
            action: this.writeRuleFileStep.bind(this),
        });
        this.setupSteps.push({
            description: `Grant Bluetooth capabilities (${this.nodeBleCapabilities}) to the Node.js binary so BLE works without sudo.`,
            actionMessage: "Granting Bluetooth capabilities to the Node.js binary...",
            action: this.grantBluetoothCapabilitiesStep.bind(this),
        });
    }

    async setBoardConfig() {
        const makeCommand = await this.boardEnv.getMakeCommand();
        const pythonCommand = await this.boardEnv.getPythonCommand();
        const xtensaGccDir = await this.boardEnv.getXtensaGccDir(pythonCommand);
        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: this.boardEnv.idfVersion,
            rootDir: this.boardEnv.espRootDir,
            exportFile: this.boardEnv.idfExportFile,
            toolchain: {
                gcc: path.join(xtensaGccDir, this.boardEnv.xtensaGccFileName),
                ar: path.join(xtensaGccDir, this.boardEnv.xtensaArFileName),
                ld: path.join(xtensaGccDir, this.boardEnv.xtensaLdFileName),
                make: makeCommand,
                python: pythonCommand
            },
        });
    }

    private getDistribution() {
        const {id, idLike, versionId} = this.readOSRelease();

        // Ubuntu & Debian
        if (id === 'ubuntu' || id === 'debian' || idLike.includes('debian')) {
            return 'UbuntuDebian';
        }

        // CentOS 7 & 8
        if (id === 'centos' || id === 'centos-stream') {
            if (versionId.startsWith('7') || versionId.startsWith('8')) {
                return 'CentOS7or8';
            }
        }

        // Arch Linux
        if (id === 'arch' || idLike.includes('arch')) {
            return 'Arch';
        }

        throw new Error('Unsupported Linux distribution.');
    }

    private readOSRelease() {
        const osReleasePath = '/etc/os-release';
        try {
            const osRelease = fs.readFile(osReleasePath);
            
            const info: Record<string, string> = {};
            for (const line of osRelease.split('\n')) {
                if (!line || line.startsWith('#') || !line.includes('=')) continue;
                
                const [key, ...rest] = line.split('=');
                let value = rest.join('=').trim();
                
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                info[key] = value.toLowerCase(); 
            }

            const id = info['ID'] || '';
            const idLike = info['ID_LIKE'] || '';
            const versionId = info['VERSION_ID'] || '';
            return {id, idLike, versionId};
        } catch(error) {
            throw new Error(`Could not read ${osReleasePath}.`, { cause: error });
        }
    }

    private async installRequiredPackagesStep() {
        if (this.distType === 'UbuntuDebian') {
            await execShell(`sudo apt-get install -y ${this.requiredPackages.join(' ')}`);
        } else if (this.distType === 'CentOS7or8') {
            await execShell(`sudo yum -y update && sudo yum install -y ${this.requiredPackages.join(' ')}`);
        } else { // Arch
            await execShell(`sudo pacman -S --needed --noconfirm ${this.requiredPackages.join(' ')}`);
        }
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
    }

    private async writeRuleFileStep() {
        const rulesContent = `
KERNEL=="ttyACM[0-9]*", MODE="0666"
KERNEL=="ttyUSB[0-9]*", MODE="0666"
`.trim() + '\n';
        const tmpFile = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'bscript-serial.rules');
        try {
            fs.writeFile(tmpFile, rulesContent);
            await execShell(`sudo install -m 644 ${tmpFile} ${this.ruleFile}`);
            await execShell(`sudo udevadm control --reload-rules`);
            await execShell(`sudo udevadm trigger`);
        } catch(error) {
            throw new Error(`Failed to write ${this.ruleFile}.`, { cause: error });
        } finally {
            fs.removeFile(tmpFile);
        }
    }

    private async grantBluetoothCapabilitiesStep() {
        const nodeBinary = nodeFs.realpathSync(process.execPath);
        try {
            await execShell(`sudo ${this.nodeBleCapabilities} ${nodeBinary}`);
        } catch (error) {
            throw new Error(
                `Failed to grant Bluetooth capabilities to ${nodeBinary}. ` +
                `If you upgrade or switch Node.js versions later, re-run setup or run: ` +
                `setcap ${this.nodeBleCapabilities} $(readlink -f "$(which node)")`,
                { cause: error },
            );
        }
    }
}

export class Esp32WindowsSetupHandler extends SetupHandler {
    boardName: BoardName = "esp32";
    boardEnv: Esp32WindowsEnv;
    makeCommand?: string;
    pythonCommand?: string;

    constructor() {
        super();
        this.boardEnv = new Esp32WindowsEnv();
    }

    loadBoardSetupSteps(): void {
        this.setupSteps.push({
            description: "Verify that git, python3 and make are installed.",
            actionMessage: "Verifying that git and python3 are installed...",
            action: this.verifyPrerequisitsInstalledStep.bind(this),
        });
        this.setupSteps.push({
            description: `Clone ESP-IDF ${this.boardEnv.idfVersion} from ${this.boardEnv.idfGitRepo}.`,
            actionMessage: `Cloning ESP-IDF ${this.boardEnv.idfVersion}... It may take a while.`,
            action: this.cloneEspIdfStep.bind(this),
        });
        this.setupSteps.push({
            description: "Run ESP-IDF install script.",
            actionMessage: "Running ESP-IDF install script...",
            action: this.runEspIdfInstallScriptStep.bind(this),
        });
    }

    async setBoardConfig() {
        const xtensaGccDir = await this.boardEnv.getXtensaGccDir(this.pythonCommand!);
        this.globalConfigHandler.updateBoardConfig(this.boardName, {
            idfVersion: this.boardEnv.idfVersion,
            rootDir: this.boardEnv.espRootDir,
            exportFile: this.boardEnv.idfExportFile,
            toolchain: {
                gcc: path.join(xtensaGccDir, this.boardEnv.xtensaGccFileName),
                ar: path.join(xtensaGccDir, this.boardEnv.xtensaArFileName),
                ld: path.join(xtensaGccDir, this.boardEnv.xtensaLdFileName),
                make: this.makeCommand!,
                python: this.pythonCommand!
            },
        });
    }

    private async verifyPrerequisitsInstalledStep() {
        // git command
        if (!await this.boardEnv.isPackageInstalled("git")) {
            throw new Error("Cannot find git command. Please install git and try again.");
        }
        this.pythonCommand = await this.boardEnv.getPythonCommand();
        this.makeCommand = await this.boardEnv.getMakeCommand();
    }

    private async cloneEspIdfStep() {
        await this.boardEnv.cloneEspIdf();
    }

    private async runEspIdfInstallScriptStep() {
        await this.boardEnv.runEspIdfInstallScript();
    }
}