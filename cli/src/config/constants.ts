import * as path from 'path';
import * as os from 'os';
import packageJson from '../../package.json';


export const GLOBAL_SETTINGS = {
    get VM_VERSION() {
        return packageJson.version;
    },

    get BLUESCRIPT_DIR() {
        return path.join(os.homedir(), '.bluescript');
    },
    
    get BLUESCRIPT_CONFIG_FILE() {
        return path.join(this.BLUESCRIPT_DIR, 'config.json');
    },

    get RUNTIME_ZIP_URL() {
        return `https://github.com/csg-tokyo/bluescript/releases/download/v${this.VM_VERSION}/release-microcontroller-v${this.VM_VERSION}.zip`;
    },

    get RUNTIME_DIR() {
        return path.join(this.BLUESCRIPT_DIR, 'microcontroller');
    },

    get ESP_ROOT_DIR() {
        return path.join(this.BLUESCRIPT_DIR, 'esp');
    },
    
    get ESP_IDF_VERSION() {
        return 'v5.4';
    },

    get ESP_IDF_GIT_REPO() {
        return 'https://github.com/espressif/esp-idf.git';
    },

    get ESP_IDF_EXPORT_FILE() {
        return path.join(this.ESP_ROOT_DIR, 'esp-idf/export.sh');
    },

    get ESP_IDF_INSTALL_FILE() {
        return path.join(this.ESP_ROOT_DIR, 'esp-idf/install.sh');
    }
}
