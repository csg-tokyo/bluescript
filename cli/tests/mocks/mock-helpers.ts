import { exec } from '../../src/core/shell';
import * as fs from '../../src/core/fs';
import inquirer from 'inquirer';
import os from 'os';
import { logger, showErrorMessages } from '../../src/core/logger';
import { GlobalConfig, GlobalConfigHandler, BoardConfig } from '../../src/core/config';

export const mockedExec = exec as jest.Mock;
export const mockedFs = fs as jest.Mocked<typeof fs>;
export const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
export const mockedOs = os as jest.Mocked<typeof os>;
export const mockedLogger = logger as jest.Mocked<typeof logger>;
export const mockedShowErrorMessages = showErrorMessages as jest.Mock;
export const MockedGlobalConfigHandler = GlobalConfigHandler as jest.Mock;

export function setupMocks() {
  jest.clearAllMocks();

  mockedOs.platform.mockReturnValue('darwin');
  mockedInquirer.prompt.mockResolvedValue({ proceed: true });
  mockedExec.mockResolvedValue({ stdout: '', stderr: '' });
  mockedFs.exists.mockReturnValue(false);
  mockedFs.downloadAndUnzip.mockResolvedValue(undefined);

  const mockIsBoardSetup = jest.fn();
  const mockUpdateGlobalConfig = jest.fn();
  const mockUpdateBoardConfig = jest.fn();
  const mockGetBoardConfig = jest.fn();
  const mockSaveGlobalConfig = jest.fn();
  const mockRemoveBoardConfig = jest.fn();
  const mockGlobalConfig: GlobalConfig = {
    version: 'v1.0.0',
    boards: {},
  };

  MockedGlobalConfigHandler.mockImplementation(() => ({
    globalConfig: mockGlobalConfig,
    isBoardSetup: mockIsBoardSetup,
    updateGlobalConfig: mockUpdateGlobalConfig,
    updateBoardConfig: mockUpdateBoardConfig,
    getBoardConfig: mockGetBoardConfig.mockImplementation((boardName) => {
      return mockGlobalConfig.boards?.[boardName as keyof BoardConfig];
    }),
    saveGlobalConfig: mockSaveGlobalConfig,
    removeBoardConfig: mockRemoveBoardConfig
  }));

  return {
    mockIsBoardSetup,
    mockUpdateGlobalConfig,
    mockUpdateBoardConfig,
    mockGetBoardConfig,
    mockSaveGlobalConfig,
    mockRemoveBoardConfig,
    mockGlobalConfig,
  };
}

export function mockProcessExit() {
  return jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
}