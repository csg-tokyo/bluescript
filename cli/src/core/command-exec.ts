import { spawn, SpawnOptions } from "child_process";
import { logger } from "./logger";
import { exists } from "./fs";

export function cwd() {
    return process.cwd();
}

export type ExecOptions = {
    cwd?: string;
    detached?: boolean;
    stdio?: 'ignore' | 'pipe';
};

type ProcessOutput = {
    stdout: string;
    stderr: string;
};

type ProcessStreamHooks = {
    onStdoutData?: (chunk: string) => void;
    onStderrData?: (chunk: string) => void;
};

type FailureMode = 'stderr' | 'detailed';

function validateCwd(cwd?: string): void {
    if (cwd && !exists(cwd)) {
        throw new Error(`${cwd} does not exist.`);
    }
}

function formatCommand(command: string, args: string[]): string {
    return [command, ...args].join(' ');
}

function rejectProcessFailure(
    formattedCommand: string,
    code: number | null,
    stdout: string,
    stderr: string,
    failureMode: FailureMode,
    spawnError?: Error,
): Error {
    if (spawnError) {
        return new Error(spawnError.message);
    }
    if (failureMode === 'stderr') {
        return new Error(stderr || `Command failed: ${formattedCommand}`);
    }
    return new Error(getErrorMessage(formattedCommand, code, stdout, stderr));
}

function runProcess(
    command: string,
    args: string[],
    options: ExecOptions = {},
    hooks?: ProcessStreamHooks,
    failureMode: FailureMode = 'detailed',
): Promise<ProcessOutput> {
    const { cwd, detached = false, stdio = 'pipe' } = options;
    const formattedCommand = formatCommand(command, args);

    return new Promise((resolve, reject) => {
        const spawnOptions: SpawnOptions = { shell: false, cwd, detached, stdio };
        const child = spawn(command, args, spawnOptions);
        let stdout = '';
        let stderr = '';

        if (stdio !== 'ignore' && child.stdout) {
            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                hooks?.onStdoutData?.(chunk);
                stdout += chunk;
            });
        }

        if (stdio !== 'ignore' && child.stderr) {
            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                hooks?.onStderrData?.(chunk);
                stderr += chunk;
            });
        }

        child.on('error', (err) => {
            reject(rejectProcessFailure(formattedCommand, null, stdout, stderr, failureMode, err));
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(rejectProcessFailure(formattedCommand, code, stdout, stderr, failureMode));
            }
        });

        if (detached) {
            child.unref();
        }
    });
}

export async function simpleExec(
    command: string,
    args: string[],
    options?: ExecOptions,
): Promise<string> {
    validateCwd(options?.cwd);
    const { stdout } = await runProcess(command, args, options, undefined, 'stderr');
    return stdout;
}

export async function execWithLog(
    command: string,
    args: string[],
    options?: ExecOptions,
): Promise<string> {
    validateCwd(options?.cwd);

    const formattedCommand = formatCommand(command, args);
    logger.log(`Executing ${formattedCommand}`);

    const { stdout } = await runProcess(command, args, options, {
        onStdoutData: (chunk) => process.stdout.write(chunk),
        onStderrData: (chunk) => process.stderr.write(chunk),
    }, 'stderr');
    return stdout;
}

export async function execShell(command: string, options?: { cwd?: string }): Promise<void> {
    validateCwd(options?.cwd);

    if (process.platform === 'win32') {
        await execWithLog('cmd.exe', ['/c', command], { cwd: options?.cwd });
    } else {
        await execWithLog('/bin/sh', ['-c', command], { cwd: options?.cwd });
    }
}

function getErrorMessage(command: string, code: number|null, stdout: string, stderr: string) {
    let message = `Command failed: ${command}\n`;
    if (code)
        message += `> Exit code: ${code}\n`;
    message += `> Stdout: ${stdout === '' ? 'N/A' : stdout}\n`;
    message += `> Stderr: ${stderr === '' ? 'N/A' : stderr}\n`;
    return message;
}
