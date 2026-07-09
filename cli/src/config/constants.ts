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
}
