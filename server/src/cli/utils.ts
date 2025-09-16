import * as os from 'os';
import * as fs from 'fs';
import chalk from 'chalk';
import { spawn } from "child_process";
import { z, ZodError } from 'zod';


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


const BsConfigSchema = z.object({
  name: z.string().min(1),
  device: z.object({
    kind: z.enum(['esp32', 'host']),
    name: z.string(),
  }),
  runtimeDir: z.string().optional(),
  modulesDir: z.string().optional()
});

export type BsConfig = z.infer<typeof BsConfigSchema>;

export function readBsConfig(path: string): BsConfig {
    if (!fs.existsSync(path)) {
        logger.error(`Cannot find file ${path}. Run 'create-project' command.`);
        throw new Error();
    }
    try {
        const fileContent = fs.readFileSync(path, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        return BsConfigSchema.parse(jsonData);
    } catch (error) {
        if (error instanceof ZodError) {
            logger.error(`Failed to parse ${path}: ${z.treeifyError(error)}`)
        } else {
            logger.error(`Failed to read ${path}.`);
        }
        throw error;
    }
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
