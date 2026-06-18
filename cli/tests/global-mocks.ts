jest.mock('../src/core/logger', () => {
    const actual = jest.requireActual('../src/core/logger/step-runner');
    const { StepSkip } = actual;
    return {
        ...jest.requireActual('../src/core/logger'),
        runStep: jest.fn(async (_message: string, action: () => Promise<unknown>) => {
            const result = await action();
            if (result instanceof StepSkip) {
                return undefined;
            }
            return result;
        }),
        runPipeline: jest.fn(async (ctx: unknown, ...steps: { action: (ctx: unknown) => Promise<void> }[]) => {
            for (const { action } of steps) {
                await action(ctx);
            }
            return ctx;
        }),
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            success: jest.fn(),
            log: jest.fn(),
            br: jest.fn(),
            showError: jest.fn(),
        },
    }
});


jest.mock('../src/core/fs', () => {
    return {
        ...jest.requireActual('../src/core/fs'),
        downloadAndUnzip: jest.fn()
    }
})


jest.mock('../src/core/shell');
// jest.mock('../src/core/fs');
jest.mock('inquirer');
