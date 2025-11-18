import { spawn } from "child_process";
import { logger } from "./logger";
import { exists } from "./fs";

export function cwd() {
    return process.cwd();
}

export function exec(command: string, options?: {cwd?: string, silent?: boolean}): Promise<string> {
    const {cwd, silent = false} = options ?? {};

    if (cwd && !exists(cwd)) {
        throw new Error(`${cwd} does not exist.`);
    }
    if (!silent) {
        logger.log(`Executing ${command}`);
    }

    return new Promise((resolve, reject) => {
        const executeProcess = spawn(command, {shell: true, cwd});
        let stdout = '';
        let stderr = '';

        executeProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            if (!silent) {
                process.stdout.write(chunk);
            }
            stdout += chunk;
        });

        executeProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            if (!silent) {
                process.stderr.write(chunk);
            }
            stderr += chunk;
        });

        executeProcess.on('error', (err) => {
            const message = getErrorMessage(command, null, stdout, stderr);
            reject(new Error(message));
        });

        executeProcess.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                const message = getErrorMessage(command, code, stdout, stderr);
                reject(new Error(message));
            }
        });
    });
}

function getErrorMessage(command: string, code: number|null, stdout: string, stderr: string) {
    let message = `Command faild: ${command}\n`;
    if (code)
        message += `> Exit code: ${code}\n`;
    message += `> Stdout: ${stdout === '' ? 'N/A' : stdout}\n`;
    message += `> Stderr: ${stderr === '' ? 'N/A' : stderr}\n`;
    return message;
}