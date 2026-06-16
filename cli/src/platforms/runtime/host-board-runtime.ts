import * as path from 'path';
import { exec } from '../../core/shell';
import { SharedObject } from "@bscript/lang";
import { ProgramOutput } from "../../core/logger/program-output";
import { BoardRuntime } from "./board-runtime";
import { CompileContext } from "../compiler/compiler-adapter";
import { HostBoardConfig } from "../../config/global-config";
import * as fs from '../../core/fs';
import { HostService, ProcessConnection } from '../../services/process';


export async function buildHostRuntime(runtimeDir: string, buildDir?: string): Promise<string> {
    const resolvedBuildDir = buildDir ?? path.join(runtimeDir, 'ports/host/build');
    const builtinModuleC = path.join(runtimeDir, 'ports/host/std-module.c');
    const shellC = path.join(runtimeDir, 'ports/host/shell.c');
    const runtimeC = path.join(runtimeDir, 'core/src/c-runtime.c');
    const commC = path.join(runtimeDir, 'ports/host/comm.c');
    const runtimeSo = path.join(resolvedBuildDir, 'c-runtime.so');
    const shell = path.join(resolvedBuildDir, 'shell');

    fs.makeDir(resolvedBuildDir);

    await exec(
        `cc -DLINUX64 -O2 -shared -fPIC -o "${runtimeSo}" "${runtimeC}" "${builtinModuleC}" "${commC}"`,
        { silent: true },
    );
    await exec(
        `cc -DLINUX64 -O2 -o "${shell}" "${shellC}" "${runtimeSo}" -lm -ldl`,
        { silent: true },
    );

    return resolvedBuildDir;
}


export class HostBoardRuntime implements BoardRuntime<SharedObject> {
    private programOutput: ProgramOutput;
    private shellProcess: ProcessConnection;
    private hostService: HostService;

    constructor(
        private boardConfig: HostBoardConfig,
        programOutput: ProgramOutput,
        private onUnexpectedDisconnect?: () => void,
    ) {
        this.programOutput = programOutput;
        this.shellProcess = new ProcessConnection(this.getShellPath());
        this.shellProcess.on('disconnected', (code) => {
            if (code !== 0) {
                this.onUnexpectedDisconnect?.();
            }
        });
        this.hostService = this.shellProcess.getService('host');
    }

    async connect(): Promise<void> {
        await this.shellProcess.connect();
        this.hostService.on('log', (message) => {
            this.programOutput.write(message);
        });
        this.hostService.on('error', (message) => {
            this.programOutput.writeError(message);
        });
    }

    async disconnect(): Promise<void> {
        this.shellProcess.disconnect();
    }

    async prepare(): Promise<CompileContext> {
        return {};
    }

    async load(output: SharedObject): Promise<number> {
        return this.hostService.load(output.soFile);
    }

    async execute(output: SharedObject): Promise<number> {
        let exectime = 0;
        for (const entry of output.entryNames) {
            exectime += await this.hostService.execute(entry.name);
        }
        return exectime;
    }

    setOutput(output: ProgramOutput): void {
        this.programOutput = output;
    }

    private getShellPath(): string {
        return path.join(this.boardConfig.buildDir, 'shell');
    }
}
