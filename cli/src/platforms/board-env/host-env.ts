import * as path from 'path';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from "../../config/constants";
import { exec } from '../../core/shell';
import { BaseBoardEnv } from "./base-env";


const HOST_ROOT_DIR = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'host');

export abstract class HostEnv extends BaseBoardEnv {
    get hostRootDir() { return path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'host'); }
    get buildDir() { return path.join(this.runtimeDir, 'ports/host/build'); }
    get builtinModuleCFile() { return path.join(this.runtimeDir, 'ports/host/std-module.c'); }
    get shellCFile() { return path.join(this.runtimeDir, 'ports/host/shell.c'); }
    get runtimeCFile() { return path.join(this.runtimeDir, 'core/src/c-runtime.c'); }
    get commCFile() { return path.join(this.runtimeDir, 'ports/host/comm.c'); }

    abstract buildHostRuntime(): Promise<void>;

    removeBoardRoot() {
        if (fs.exists(HOST_ROOT_DIR)) {
            fs.removeDir(HOST_ROOT_DIR);
        }
    }

    refreshBoardRoot() {
        this.removeBoardRoot();
        fs.makeDir(HOST_ROOT_DIR);
    }
}

export class HostDarwinEnv extends HostEnv {
    get runtimeSoFile() { return path.join(this.buildDir, 'c-runtime.so'); }
    get shellFile() { return path.join(this.buildDir, 'shell'); }

    async buildHostRuntime() {
        try {
            await exec(
                `cc -DLINUX64 -O2 -shared -fPIC -o "${this.runtimeSoFile}" "${this.runtimeCFile}" "${this.builtinModuleCFile}" "${this.commCFile}"`,
                { silent: true },
            );
            await exec(
                `cc -DLINUX64 -O2 -o "${this.shellFile}" "${this.shellCFile}" "${this.runtimeSoFile}" -lm -ldl`,
                { silent: true },
            );
        } catch(error) {
            throw new Error('Failed to compile host runtime.', { cause: error });
        }
        
    }
}