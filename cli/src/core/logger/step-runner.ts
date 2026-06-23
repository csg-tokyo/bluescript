import chalk from 'chalk';
import { INFO_PREFIX } from './cli-logger';
import { logUpdater } from './log-updater';

export class StepSkip {
    constructor(public readonly reason: string) {}
}

export function skip(reason: string): StepSkip {
    return new StepSkip(reason);
}

export async function runStep<T>(message: string, action: () => Promise<T | StepSkip>): Promise<T | undefined> {
    logUpdater.update(INFO_PREFIX, message);
    try {
        const result = await action();
        if (result instanceof StepSkip) {
            logUpdater.persistent(INFO_PREFIX, message, chalk.yellow(`Skipped - ${result.reason}`));
            return undefined;
        }
        logUpdater.persistent(INFO_PREFIX, message, chalk.green('OK'));
        return result;
    } catch (error) {
        logUpdater.persistent(INFO_PREFIX, message, chalk.red('Failed'));
        throw error;
    }
}

export class LoadStepLogger {
    private readonly messagePrefix = "Loading...";

    start() {
        logUpdater.update(INFO_PREFIX, this.messagePrefix);
    }

    update(percent: number) {
        logUpdater.update(INFO_PREFIX, this.messagePrefix, `${percent}%`);
    }

    endWithSuccess() {
        logUpdater.persistent(INFO_PREFIX, this.messagePrefix, chalk.green('OK'));
    }

    endWithFailure() {
        logUpdater.persistent(INFO_PREFIX, this.messagePrefix, chalk.red('Failed'));
    }
}
