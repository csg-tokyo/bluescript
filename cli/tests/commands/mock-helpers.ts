import { simpleExec, execWithLog, execShell, cwd } from '../../src/core/command-exec';
import inquirer from 'inquirer';
import { logger } from '../../src/core/logger';
import { downloadAndUnzip } from '../../src/core/fs';


export const mockedSimpleExec = simpleExec as jest.Mock;
export const mockedExecWithLog = execWithLog as jest.Mock;
export const mockedExecShell = execShell as jest.Mock;
export const mockedCwd = cwd as jest.Mock;
export const mockedDownloadAndUnzip = downloadAndUnzip as jest.Mock;
export const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
export const mockedLogger = logger as jest.Mocked<typeof logger>;

export function mockProcessExit() {
  return jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
}
