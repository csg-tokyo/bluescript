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
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            success: jest.fn(),
            log: jest.fn(),
            br: jest.fn(),
            showError: jest.fn(),
        },
    };
});
