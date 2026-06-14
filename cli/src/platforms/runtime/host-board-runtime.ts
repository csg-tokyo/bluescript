import * as path from 'path';
import { exec } from '../../core/shell';
import { SharedObject } from "@bscript/lang";
import { ProgramOutput } from "../../core/logging/program-output";
import { BoardRuntime } from "./board-runtime";
import { CompileContext } from "../compiler/compiler-adapter";
import { HostBoardConfig } from "../../config/global-config";
import * as fs from '../../core/fs';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { Protocol } from '../../services/device-protocol';

function protocolLineBuilder(protocol: Protocol, payload: string) {
    const protocolStr = String(protocol).padStart(2, '0');
    return `${protocolStr} ${payload}\n`;
}

export async function buildHostRuntime(runtimeDir: string, buildDir?: string): Promise<string> {
    const resolvedBuildDir = buildDir ?? path.join(runtimeDir, 'ports/host/build');
    const builtinModuleC = path.join(runtimeDir, 'ports/host/std-module.c');
    const shellC = path.join(runtimeDir, 'ports/host/shell.c');
    const runtimeC = path.join(runtimeDir, 'core/src/c-runtime.c');
    const runtimeSo = path.join(resolvedBuildDir, 'c-runtime.so');
    const shell = path.join(resolvedBuildDir, 'shell');

    fs.makeDir(resolvedBuildDir);

    await exec(
        `cc -DLINUX64 -O2 -shared -fPIC -o "${runtimeSo}" "${runtimeC}" "${builtinModuleC}"`,
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
    private shellProcess: ChildProcessWithoutNullStreams | null = null;

    constructor(
        private boardConfig: HostBoardConfig,
        programOutput: ProgramOutput,
        private onUnexpectedDisconnect?: () => void,
    ) {
        this.programOutput = programOutput;
    }

    async connect(): Promise<void> {
        this.shellProcess = spawn(this.getShellPath());
        this.shellProcess.stdout.setEncoding('utf8');
        this.shellProcess.stderr.setEncoding('utf8');
        this.shellProcess.stdout.pipe(process.stdout); // TODO: programOutputに書く
        this.shellProcess.stderr.pipe(process.stderr);
    }

    async disconnect(): Promise<void> {
        if (this.shellProcess) {
            this.shellProcess.stdin.end();
        }
    }

    async prepare(): Promise<CompileContext> {
        return {};
    }

    async load(output: SharedObject): Promise<void> {
        this.sendLine(Protocol.Load, output.soFile);
    }

    async execute(output: SharedObject): Promise<void> {
        for (const entryName of output.entryNames) {
            this.sendLine(Protocol.Jump, entryName.name);
        }
    }

    setOutput(output: ProgramOutput): void {
        this.programOutput = output;
    }

    private sendLine(protocol: Protocol, line: string) {
        if (this.shellProcess === null) {
            throw new Error('The host process is not running.');
        }
        this.shellProcess.stdin.cork();
        this.shellProcess.stdin.write(protocolLineBuilder(protocol, line));
        process.nextTick(() => this.shellProcess?.stdin.uncork());
    }

    private getShellPath(): string {
        return path.join(this.boardConfig.buildDir, 'shell');
    }
}
