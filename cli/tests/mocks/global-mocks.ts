jest.mock('../../src/core/logger', () => {
    const { SkipStep } = jest.requireActual('../../src/core/logger');
    const mockDecorator = jest.fn().mockImplementation(
        (message: string) => {
        return function (
            target: any,
            propertyKey: string,
            descriptor: PropertyDescriptor
        ) {
            const originalMethod = descriptor.value;
            descriptor.value = async function (...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error) {
                if (error instanceof SkipStep) {return;}
                throw error;
            }
            };
            return descriptor;
        };
        }
    )
    return {
        ...jest.requireActual('../../src/core/logger'),
        LogStep: mockDecorator,
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            success: jest.fn(),
            log: jest.fn(),
            br: jest.fn(),
        },
        showErrorMessages: jest.fn(),
    }
});

jest.mock('../../src/core/global-config');
jest.mock('../../src/core/project-config');
jest.mock('../../src/core/shell');
jest.mock('../../src/core/fs');
jest.mock('inquirer');