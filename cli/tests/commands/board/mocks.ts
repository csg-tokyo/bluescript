import { GlobalConfigHandler } from '../../../src/core/config';
import { logger, showErrorMessages } from '../../../src/core/logger';
import { exec } from '../../../src/core/shell';
import * as fs from '../../../src/core/fs';
import inquirer from 'inquirer';
import os from 'os';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn(),
}));

jest.mock('../../../src/core/logger', () => {
    const { SkipStep } = jest.requireActual('../../../src/core/logger');
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
        ...jest.requireActual('../../../src/core/logger'),
        LogStep: mockDecorator,
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            success: jest.fn(),
            log: jest.fn(),
        },
        showErrorMessages: jest.fn(),
    }
});

jest.mock('../../../src/core/config');
jest.mock('../../../src/core/shell');
jest.mock('../../../src/core/fs');
jest.mock('inquirer');

export const createMocks = () => {
    const mockedExec = exec as jest.Mock;
    const mockedFs = fs as jest.Mocked<typeof fs>;
    const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
    const mockedOs = os as jest.Mocked<typeof os>;
    const mockedLogger = logger as jest.Mocked<typeof logger>;
    const mockedShowErrorMessages = showErrorMessages as jest.Mock;
    const MockedGlobalConfigHandler = GlobalConfigHandler as jest.Mock;

    return {
        mockedExec,
        mockedFs,
        mockedInquirer,
        mockedOs,
        mockedLogger,
        mockedShowErrorMessages,
        MockedGlobalConfigHandler,
    };
};

export type Mocks = ReturnType<typeof createMocks>;