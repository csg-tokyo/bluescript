import chalk from 'chalk';

export interface ProgramOutput {
    onRunStart?(): void;
    onRunEnd?(): void;
    write(message: string): void;
    writeError(message: string): void;
}

export function createConsoleOutput(): ProgramOutput {
    return {
        write(message: string) {
            console.log(message.trimEnd());
        },
        writeError(message: string) {
            console.log(chalk.red.bold(message.trimEnd()));
        },
    };
}

export function createBoxedOutput(): ProgramOutput {
    let isRunning = false;
    const columns = process.stdout.columns || 60;
    const boxWidth = columns & ~1;

    return {
        onRunStart() {
            isRunning = true;
            const lineLength = (boxWidth - 8) / 2;
            process.stdout.write(`\n${'='.repeat(lineLength)} OUTPUT ${'='.repeat(lineLength)}\n`);
        },
        onRunEnd() {
            if (!isRunning) return;
            process.stdout.write(`${'='.repeat(boxWidth)}\n\n`);
            isRunning = false;
        },
        write(message: string) {
            if (!isRunning) return;
            process.stdout.write(message);
        },
        writeError(message: string) {
            if (!isRunning) return;
            process.stdout.write(chalk.red.bold(message));
        },
    };
}

export function createWebSocketOutput(service: {
    log(message: string): void | Promise<void>;
    error(message: string): void | Promise<void>;
}): ProgramOutput {
    return {
        write(message: string) {
            void service.log(message);
        },
        writeError(message: string) {
            void service.error(message);
        },
    };
}
