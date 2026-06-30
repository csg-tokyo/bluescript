import * as path from "path";
import * as fs from "fs";
import * as os from 'os';
import { Project } from "../../src/compiler/project";
import { PackageForHostUnix, PackageForHostWindows } from "../../src/compiler/package";
import { HostUnixToolchain, HostWindowsToolchain } from "../../src/compiler/board-toolchain/host-toolchain";
import { HostUnixCompilerTestEnv, HostWindowsCompilerTestEnv, runtimeDir } from "./test-env";
import { SharedLibrary } from "../../src/compiler/board-toolchain/board-toolchain";
import { CompilerSession } from "../../src/compiler/compiler-session";
import { executeCommand } from "../../src/compiler/utils";


const runtimeBuildDir = path.join(runtimeDir, 'ports/host/build');
const builtinModuleC = path.join(runtimeDir, 'ports/host/std-module.c');
const shellC = path.join(runtimeDir, 'ports/host/shell.c');
const runtimeC = path.join(runtimeDir, 'core/src/c-runtime.c');
const commC = path.join(runtimeDir, 'ports/host/comm.c');

// Unix (darwin)
const runtimeSo = path.join(runtimeBuildDir, 'c-runtime.so');
const executableShell = path.join(runtimeBuildDir, 'shell');

// Windows
const runtimeDll = path.join(runtimeBuildDir, 'c-runtime.dll');
const executableShellWin = path.join(runtimeBuildDir, 'shell.exe');

const buildRuntimeUnix = async () => {
    fs.mkdirSync(runtimeBuildDir, { recursive: true });
    await executeCommand('cc', [
        '-DLINUX64', '-O2', '-shared', '-fPIC',
        '-o', runtimeSo,
        runtimeC, builtinModuleC, commC,
    ]);
    await executeCommand('cc', [
        '-DLINUX64', '-O2',
        '-o', executableShell,
        shellC, runtimeSo, '-lm', '-ldl',
    ]);
};

const buildRuntimeWindows = async () => {
    fs.mkdirSync(runtimeBuildDir, { recursive: true });
    await executeCommand('gcc', [
        '-DLINUX64', '-DWIN64', '-O2', '-shared',
        '-o', runtimeDll,
        runtimeC, builtinModuleC, commC,
    ]);
    await executeCommand('gcc', [
        '-DLINUX64', '-DWIN64', '-O2',
        '-o', executableShellWin,
        shellC, runtimeDll, '-lm',
    ]);
};

export const buildRuntime = async () => {
    if (os.platform() === 'darwin') {
        await buildRuntimeUnix();
    } else if (os.platform() === 'win32') {
        await buildRuntimeWindows();
    } else {
        throw new Error('Unsupported OS.');
    }
};

export const createTestEnv = () => {
    if (os.platform() === 'darwin') {
        return new HostUnixCompilerTestEnv('compiler-test-host')
    } else if (os.platform() === 'win32') {
        return new HostWindowsCompilerTestEnv('compiler-test-host')
    } else {
        throw new Error('Unsupported OS.');
    }
}

export const compile = async (testEnv: HostUnixCompilerTestEnv | HostWindowsCompilerTestEnv) => {
    if (os.platform() === 'darwin') {
        let toolchain = new HostUnixToolchain(runtimeDir);
        const project = Project.load<PackageForHostUnix>(
            testEnv.mainPackageName,
            testEnv.getPackageReader() as (name: string) => PackageForHostUnix
        );
        const session = new CompilerSession<PackageForHostUnix, SharedLibrary>(toolchain);
        await session.buildProject(project);
        return session;
    } else if (os.platform() === 'win32') {
        let toolchain = new HostWindowsToolchain(runtimeDir);
        const project = Project.load<PackageForHostWindows>(
            testEnv.mainPackageName,
            testEnv.getPackageReader() as (name: string) => PackageForHostWindows
        );
        const session = new CompilerSession<PackageForHostWindows, SharedLibrary>(toolchain);
        await session.buildProject(project);
        return session;
    } else {
        throw new Error('Unsupported OS.');
    }
}


