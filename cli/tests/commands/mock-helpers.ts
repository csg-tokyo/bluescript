import { exec, cwd } from '../../src/core/shell';
import inquirer from 'inquirer';
import { logger, showErrorMessages } from '../../src/core/logger';
import { GlobalConfigHandler } from '../../src/config/global-config';
import { ProjectConfigHandler } from '../../src/config/project-config';
import packageJson from '../../package.json';
import { downloadAndUnzip } from '../../src/core/fs';


export const mockedExec = exec as jest.Mock;
export const mockedCwd = cwd as jest.Mock;
// export const mockedFs = fs as jest.Mocked<typeof fs>;
export const mockedDownloadAndUnzip = downloadAndUnzip as jest.Mock;
export const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
export const mockedLogger = logger as jest.Mocked<typeof logger>;
export const mockedShowErrorMessages = showErrorMessages as jest.Mock;

// export function setupMocks() {
//   jest.clearAllMocks();

//   mockedInquirer.prompt.mockResolvedValue({ proceed: true });
//   mockedExec.mockResolvedValue('');
//   mockedCwd.mockReturnValue('current/working/dir');
//   // mockedFs.exists.mockReturnValue(false);
//   // mockedFs.downloadAndUnzip.mockResolvedValue(undefined);

//   const mockGlobalConfigHandler = {
//       getConfig: jest.fn(),
//       isBoardSetup: jest.fn(),
//       isRuntimeSetup: jest.fn(),
//       setRuntimeDir: jest.fn(),
//       update: jest.fn(),
//       updateBoardConfig: jest.fn(),
//       getBoardConfig: jest.fn(),
//       removeBoardConfig: jest.fn(),
//       save: jest.fn(),
//       getAvailableBoards: jest.fn(),
//   };
//   jest.spyOn(GlobalConfigHandler, 'load').mockReturnValue(mockGlobalConfigHandler as unknown as GlobalConfigHandler);

//   const mockProjectConfigHandler = {
//       getConfig: jest.fn().mockReturnValue({version: packageJson.version}),
//       getBoardName: jest.fn(),
//       asBoard: jest.fn(),
//       update: jest.fn(),
//       updateWithDependency: jest.fn(),
//       save: jest.fn(),
//       addDependency: jest.fn(),
//       removeDepedency: jest.fn(),
//       dependencyExists: jest.fn(),
//       getDepenencies: jest.fn()
//   };
//   jest.spyOn(ProjectConfigHandler, 'createTemplate').mockReturnValue(mockProjectConfigHandler as unknown as ProjectConfigHandler);
//   jest.spyOn(ProjectConfigHandler, 'load').mockReturnValue(mockProjectConfigHandler as unknown as ProjectConfigHandler);

//   return {
//     globalConfigHandler: mockGlobalConfigHandler,
//     projectConfigHandler: mockProjectConfigHandler
//   }
// }

export function mockProcessExit() {
  return jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
}