import * as path from 'path';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from '../../config/constants';
import { simpleExec } from '../../core/command-exec';
import { BoardEnv } from './common-env';

export abstract class HostEnv extends BoardEnv {
    get hostRootDir() { return path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'host'); }
    get buildDir() { return path.join(this.runtimeDir, 'ports/host/build'); }
    get builtinModuleCFile() { return path.join(this.runtimeDir, 'ports/host/std-module.c'); }
    get shellCFile() { return path.join(this.runtimeDir, 'ports/host/shell.c'); }
    get runtimeCFile() { return path.join(this.runtimeDir, 'core/src/c-runtime.c'); }
    get commCFile() { return path.join(this.runtimeDir, 'ports/host/comm.c'); }

    abstract get shellFile(): string;
    abstract buildHostRuntime(): Promise<void>;

    removeBoardRoot() {
        fs.removeDir(this.hostRootDir);
    }

    refreshBoardRoot() {
        this.removeBoardRoot();
        fs.makeDir(this.hostRootDir);
    }

    removeBuildDir() {
        fs.removeDir(this.buildDir);
    }
}

export class HostDarwinEnv extends HostEnv {
    get runtimeSoFile() { return path.join(this.buildDir, 'c-runtime.so'); }
    get shellFile() { return path.join(this.buildDir, 'shell'); }

    async buildHostRuntime() {
        fs.makeDir(this.buildDir);
        try {
            await simpleExec('cc', [
                '-DLINUX64', '-O2', '-shared', '-fPIC',
                '-o', this.runtimeSoFile,
                this.runtimeCFile, this.builtinModuleCFile, this.commCFile,
            ]);
            await simpleExec('cc', [
                '-DLINUX64', '-O2',
                '-o', this.shellFile,
                this.shellCFile, this.runtimeSoFile,
                '-lm', '-ldl',
            ]);
        } catch(error) {
            throw new Error('Failed to compile host runtime.', { cause: error });
        }
        
    }
}

export class HostWindowsEnv extends HostEnv {
    get runtimeDllFile() { return path.join(this.buildDir, 'c-runtime.dll'); }
    get shellFile() { return path.join(this.buildDir, 'shell.exe'); }

    async buildHostRuntime() {
        fs.makeDir(this.buildDir);
        try {
            await simpleExec('gcc', [
                '-DLINUX64', '-O2', '-shared',
                '-o', this.runtimeDllFile,
                this.runtimeCFile, this.builtinModuleCFile, this.commCFile,
            ]);
            await simpleExec('gcc', [
                '-DLINUX64', '-O2',
                '-o', this.shellFile,
                this.shellCFile, this.runtimeDllFile,
                '-lm',
            ]);
        } catch (error) {
            throw new Error('Failed to compile host runtime.', { cause: error });
        }
    }
}
