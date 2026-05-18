import { spawn } from "child_process";

export function executeCommand(command: string, args: string[], cwd?: string, showStdout = false, showStderr = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const executeProcess = spawn(command, args, { shell: false, cwd }); 

    let stdout = '';
    let stderr = '';

    executeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        if (showStdout) {
            process.stdout.write(chunk);
        }
        stdout += chunk;
    });

    executeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        if (showStderr) {
            process.stderr.write(chunk);
        }
        stderr += chunk;
    });

    executeProcess.on('error', (err) => {
        reject(new Error(`Failed to execute ${command}: ${err.message}. stderr: ${stderr}`));
    });

    executeProcess.on('close', (code) => {
        if (code === 0) {
            resolve();
        } else {
            reject(new Error(`Failed to execute ${command}. Code: ${code}. stderr: ${stderr}`));
        }
    });
  });
}

export function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    else return String(error);
}
