import chalk from 'chalk';
import readline from 'readline';

const ERROR_PREFIX = chalk.red.bold('ERROR:');
const WARN_PREFIX = chalk.yellow.bold('WARN:');
const INFO_PREFIX = chalk.blue.bold('INFO:');
const SUCCESS_PREFIX = chalk.green.bold('SUCCESS:');

export class LogUpdater {
  private stream: NodeJS.WriteStream;
  private lastOutput = '';
  private isUpdating = false;

  constructor(stream: NodeJS.WriteStream) {
    this.stream = stream;
  }

  public update(...text: string[]): void {
    this.clear();
    const newOutput = text.join(' ');
    this.stream.write(newOutput);
    this.lastOutput = newOutput;
    this.isUpdating = true;
  }

  public persistent(...text: string[]): void {
    this.update(...text);
    this.done();
  }

  public done(): void {
    if (!this.isUpdating) {
      return;
    }
    this.stream.write('\n');
    this.isUpdating = false;
    this.lastOutput = '';
  }

  public clear(): void {
    if (!this.isUpdating) {
      return;
    }
    const lines = this.getLineCount(this.lastOutput);
    for (let i = 0; i < lines; i++) {
      if (i > 0) {
        readline.moveCursor(this.stream, 0, -1);
      }
      readline.cursorTo(this.stream, 0);
      readline.clearLine(this.stream, 1);
    }
    this.isUpdating = false;
    this.lastOutput = '';
  }

  private getLineCount(str: string): number {
    const columns = this.stream.columns || 80;
    let lineCount = 0;
    for (const line of str.split('\n')) {
      const strippedLine = line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      lineCount += Math.max(1, Math.ceil(strippedLine.length / columns));
    }
    return lineCount;
  }
}

export const logUpdater = new LogUpdater(process.stdout);

export const logger = {
  error(...messages: string[]): void {
    logUpdater.done();
    console.log(ERROR_PREFIX, ...messages);
  },
  
  warn(...messages: string[]): void {
    logUpdater.done();
    console.log(WARN_PREFIX, ...messages);
  },

  info(...messages: string[]): void {
    logUpdater.done();
    console.log(INFO_PREFIX, ...messages);
  },
  
  success(...messages: string[]): void {
    logUpdater.done();
    console.log(SUCCESS_PREFIX, ...messages);
  },

  log(...messages: string[]): void {
    logUpdater.done();
    console.log(...messages);
  },

  br(): void {
    console.log();
  }
};


export class ProgramLogger {
  private isLogging = false;
  private boxWidth: number;

  constructor() {
    const columns = process.stdout.columns || 60;
    this.boxWidth = columns & ~1;
  }

  start() { 
    this.isLogging = true;
    const lineLength = (this.boxWidth - 8) / 2 
    process.stdout.write(`\n${'='.repeat(lineLength)} OUTPUT ${'='.repeat(lineLength)}\n`);
  }
  end() {
    if (!this.isLogging) return; 
    process.stdout.write(`${'='.repeat(this.boxWidth)}\n\n`);
    this.isLogging = false;
  }

  log(message: string) {
    if (!this.isLogging) return; 
    process.stdout.write(message);
  }

  error(message: string) {
    if (!this.isLogging) return; 
    process.stdout.write(chalk.red.bold(message));
  }
}


export class SkipStep {
  result: any;
  message: string;

  constructor(message: string, result: any) {
    this.message = message;
    this.result = result;
  }
}

/**
 * A decorator factory for showing the log message.
 * Show the message during execution of the target function and show 'OK' or 'Failed' at the end after the execution.
 * If SkipStep is throwed, show 'Skipped' at the end.
 */
export function LogStep(message: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
          logUpdater.update(INFO_PREFIX, message);
          try {
            const result = await originalMethod.apply(this, args);
            logUpdater.persistent(INFO_PREFIX, message, chalk.green('OK'));
            return result;
          } catch (error) {
            if (error instanceof SkipStep) {
              logUpdater.persistent(INFO_PREFIX, message, chalk.yellow(`Skipped - ${error.message}`));
              return error.result;
            } else {
              logUpdater.persistent(INFO_PREFIX, message, chalk.red('Failed'));
              throw error;
            }
          }
        };

        return descriptor;
  }
}

export function showErrorMessages(error: unknown, indent: number = 2) {
  const messages: string[] = [];
  let currentError = error;
  while (currentError) {
    if (currentError instanceof Error) {
      messages.push(currentError.message);
      currentError = currentError.cause;
    } else {
      messages.push(`Unknown Error: ${error}`);
      break;
    }
  }
  messages.forEach(m => {
    console.log(' '.repeat(indent) + m);
  });
}