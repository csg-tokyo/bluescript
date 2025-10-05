import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';


export const GLOBAL_PATH = {
    BSCRIPT_DIR: () => path.join(os.homedir(), 'bscript'),
    RUNTIME_DIR: () => path.join(os.homedir(), 'bscript', 'microcontroller'),
    RUNTIME_ESP_PORT_DIR: () => path.join(os.homedir(), 'bscript', 'microcontroller', 'ports', 'esp32'),
    PACKAGES_DIR: () => path.join(os.homedir(),'bscript', 'modules'),
}

export const ESP_IDF_PATH = {
    VERSION: 'v5.4',
    GIT_REPO: 'https://github.com/espressif/esp-idf.git',
    ROOT: () => path.join(GLOBAL_PATH.BSCRIPT_DIR(), 'esp'),
    EXPORT_FILE: () => path.join(GLOBAL_PATH.BSCRIPT_DIR(), 'esp-idf/export.sh'),
    INSTALL_FILE: () => path.join(GLOBAL_PATH.BSCRIPT_DIR(), 'esp-idf/install.sh'),
    XTENSA_GCC_DIR: () => {
        const toolJsonPath = path.join(GLOBAL_PATH.BSCRIPT_DIR(), 'esp/esp-idf/tools/tools.json');
        try {
            const fileContent = fs.readFileSync(toolJsonPath, 'utf-8');
            const jsonData = JSON.parse(fileContent);
            const xtensaEspElfVersion = jsonData.tools.find((t:any) => t.name === 'xtensa-esp-elf').versions[0].name;
            return path.join(os.homedir(), '.espressif/tools/xtensa-esp-elf', xtensaEspElfVersion, 'xtensa-esp-elf/bin');
        } catch (error) {
            throw new Error(`Faild to read ${toolJsonPath}: ${error}`);
        }
    }
}

export const ZIP_URL = {
    RUNTIME: (version: string) => `https://github.com/csg-tokyo/bluescript/releases/download/${version}/release-microcontroller-${version}.zip`,
    PACKAGES: (version: string) => `https://github.com/csg-tokyo/bluescript/releases/download/${version}/release-modules-${version}.zip`
}

export const PACKAGE_PATH = {
    BSCONFIG_FILE: (packageRoot: string) => path.join(packageRoot, 'bsconfig.json'),
    ENTRY_FILE: (packageRoot: string) => path.join(packageRoot, 'index.bs'),
    DIST_DIR: (packageRoot: string) => path.join(packageRoot, 'dist'),
    BUILD_DIR: (packageRoot: string) => path.join(packageRoot, 'dist/build'),
    LOCAL_PACKAGES_DIR: (packageRoot: string) => path.join(packageRoot, 'packages'),
    SUB_PACKAGE_DIR: (packagesDir: string, name: string) => path.join(packagesDir, name),
}
