import { ERROR_PREFIX, INFO_PREFIX, SUCCESS_PREFIX, WARN_PREFIX } from './format';
import { logUpdater } from './log-updater';

export interface CliLogger {
    error(...messages: string[]): void;
    warn(...messages: string[]): void;
    info(...messages: string[]): void;
    success(...messages: string[]): void;
    log(...messages: string[]): void;
    br(): void;
    showError(error: unknown, indent?: number): void;
}

export const logger: CliLogger = {
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
    },

    showError(error: unknown, indent: number = 2): void {
        logUpdater.done();
        for (const message of collectErrorMessages(error)) {
            console.log(' '.repeat(indent) + message);
        }
    },
};

export function collectErrorMessages(error: unknown): string[] {
    const messages: string[] = [];
    let currentError = error;
    while (currentError) {
        if (currentError instanceof Error) {
            messages.push(currentError.message);
            currentError = currentError.cause;
        } else {
            messages.push(`Unknown Error: ${String(error)}`);
            break;
        }
    }
    return messages;
}
