import { exec, cwd } from '../../src/core/shell';
import inquirer from 'inquirer';
import { logger, showErrorMessages } from '../../src/core/logger';
import { downloadAndUnzip } from '../../src/core/fs';


export const mockedExec = exec as jest.Mock;
export const mockedCwd = cwd as jest.Mock;
export const mockedDownloadAndUnzip = downloadAndUnzip as jest.Mock;
export const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
export const mockedLogger = logger as jest.Mocked<typeof logger>;
export const mockedShowErrorMessages = showErrorMessages as jest.Mock;


export function mockProcessExit() {
  return jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
}