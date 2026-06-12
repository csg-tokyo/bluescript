import chalk from 'chalk';
import { INFO_PREFIX } from './format';
import { logUpdater } from './log-updater';

export class StepSkip {
    constructor(public readonly reason: string) {}
}

export function skip(reason: string): StepSkip {
    return new StepSkip(reason);
}

export interface PipelineStep<TContext> {
    label: string;
    action: (ctx: TContext) => void | Promise<void>;
}

export function step<TContext>(
    label: string,
    action: (ctx: TContext) => void | Promise<void>,
): PipelineStep<TContext> {
    return { label, action };
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

export async function runPipeline<TContext>(
    ctx: TContext,
    ...steps: PipelineStep<TContext>[]
): Promise<TContext> {
    for (const { label, action } of steps) {
        await runStep(label, async () => {
            await action(ctx);
        });
    }
    return ctx;
}
