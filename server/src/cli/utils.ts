import * as os from 'os';
import * as fs from 'fs';
import chalk from 'chalk';
import { spawn } from "child_process";

type HostOSType = 'macos' | 'linux' | 'windows' | 'unknown';


export function getHostOSType():HostOSType {
    const platform = os.platform();
    if (platform === 'darwin') return 'macos';
    if (platform === 'linux') return 'linux';
    if (platform === 'win32') return 'windows';
    return 'unknown';
}

export const logger = {
  error(message: string): void {
    console.log(chalk.red.bold('ERROR:'), message);
  },
  
  warn(message: string): void {
    console.log(chalk.yellow.bold('WARN:'), message);
  },

  info(message: string): void {
    console.log(chalk.blue.bold('INFO:'), message);
  },
  
  success(message: string): void {
    console.log(chalk.green.bold('SUCCESS:'), message);
  },

  bsLog(message: string): void {
    process.stdout.write(message);
  },

  bsError(message: string): void {
    process.stdout.write(chalk.red.bold(message));
  }
};


export function directoryExists(dirPath: string): boolean {
  try {
    const stats = fs.statSync(dirPath);
    return stats.isDirectory();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false;
    }
    return false;
  }
}

export function createDirectory(dirPath: string, recursive: boolean) {
    fs.mkdirSync(dirPath, {recursive});
}

export function deleteDirectory(dirPath: string) {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

export function executeCommand(command: string, cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const executeProcess = spawn(command, {shell: true, cwd});

    executeProcess.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    executeProcess.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    executeProcess.on('error', (err) => {
      reject(new Error(`Failed to setup process: ${err.message}`));
    });

    executeProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to execute ${command}. Code: ${code}`));
      }
    });
  });
}
