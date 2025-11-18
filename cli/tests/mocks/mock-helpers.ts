import { exec, cwd } from '../../src/core/shell';
import * as fs from '../../src/core/fs';
import inquirer from 'inquirer';
import { logger, showErrorMessages } from '../../src/core/logger';
import { GlobalConfig, GlobalConfigHandler, BoardConfig } from '../../src/core/global-config';
import { ProjectConfigHandler } from '../../src/core/project-config';

export const mockedExec = exec as jest.Mock;
export const mockedCwd = cwd as jest.Mock;
export const mockedFs = fs as jest.Mocked<typeof fs>;
export const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
export const mockedLogger = logger as jest.Mocked<typeof logger>;
export const mockedShowErrorMessages = showErrorMessages as jest.Mock;
export const MockedGlobalConfigHandler = GlobalConfigHandler as jest.Mock;
export const MockedProjectConfigHandler = ProjectConfigHandler as jest.Mock;

export function setupMocks() {
  jest.clearAllMocks();

  mockedInquirer.prompt.mockResolvedValue({ proceed: true });
  mockedExec.mockResolvedValue('');
  mockedCwd.mockReturnValue('current/working/dir');
  mockedFs.exists.mockReturnValue(false);
  mockedFs.downloadAndUnzip.mockResolvedValue(undefined);

  const mockGlobalConfig: GlobalConfig = {
    version: 'v1.0.0',
    boards: {},
  }
  const mockGlobalConfigHandler = {
    isBoardSetup: jest.fn(),
    updateGlobalConfig: jest.fn(),
    updateBoardConfig: jest.fn(),
    getBoardConfig: jest.fn().mockImplementation((boardName) => {
      return mockGlobalConfig.boards?.[boardName as keyof BoardConfig];
    }),
    saveGlobalConfig: jest.fn(),
    removeBoardConfig: jest.fn(),
    globalConfig: mockGlobalConfig
  }
  MockedGlobalConfigHandler.mockImplementation(() => mockGlobalConfigHandler);

  const mockProjectConfigHandler = {
    set: jest.fn(),
    save: jest.fn(),
    getTemplate: jest.fn()
  }
  MockedProjectConfigHandler.mockImplementation(() => mockProjectConfigHandler);

  return {
    globalConfigHandler: mockGlobalConfigHandler,
    projectConfigHandler: mockProjectConfigHandler
  };
}

export function mockProcessExit() {
  return jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
}