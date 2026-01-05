import { handleInstallCommand } from '../../../src/commands/project/install';
import * as fs from '../../../src/core/fs';
import * as path from 'path';
import {
    mockedCwd,
    mockedExec,
    mockedLogger,
    mockedShowErrorMessages,
    mockProcessExit,
} from '../mock-helpers';
import { deleteGlobalEnv, setupDefaultGlobalEnv, setupGlobalEnvWithEsp32 } from '../global-env-helper';
import { spyGlobalSettings } from '../global-env-helper';
import { PROJECT_PATHS } from '../../../src/config/project-config';


describe('install command', () => { 
    const projectRoot = path.join(__dirname, '../../../temp-files/test-project');

    beforeAll(() => {
        spyGlobalSettings('install');
    })

    beforeEach(() => {
        mockedCwd.mockReturnValue(projectRoot);
    });

    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
        deleteDummyProject(projectRoot);
    });

    it('should show warning and exit if update is needed', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv(true);

        // --- Act ---
        await handleInstallCommand('https://github.com/bluescript-lang/pkg-gpio-esp32.git', {});

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should install a dependency', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        createDummyProject(projectRoot);
        mockedExec.mockImplementation((command) => {
            if (command.startsWith('git clone')) {
                dummyGitClone(command, {});
            }
        });
        
        // --- Act ---
        await handleInstallCommand('https://github.com/bluescript-lang/pkg-gpio-esp32.git', {});

        // --- Assert ---
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-gpio-esp32-project')));
        expect(getProjectConfig(projectRoot).dependencies['pkg-gpio-esp32-project']).toBe('https://github.com/bluescript-lang/pkg-gpio-esp32.git');
    });

    it('should install packages following the chain of dependencies', async () => {
        // Install led and led depends on gpio.
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        createDummyProject(projectRoot);
        mockedExec.mockImplementation((command) => {
            if (command.startsWith('git clone')) {
                if (command.includes('led')) {
                    dummyGitClone(command, {
                        'pkg-gpio-esp32-project': 'https://github.com/bluescript-lang/pkg-gpio-esp32.git'
                    });
                } else if (command.includes('gpio')) {
                    dummyGitClone(command, {});
                }
            }
        });
        
        // --- Act ---
        await handleInstallCommand('https://github.com/bluescript-lang/pkg-led-esp32.git', {});

        // --- Assert ---
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-led-esp32-project')));
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-gpio-esp32-project')));
        expect(getProjectConfig(projectRoot).dependencies['pkg-led-esp32-project']).toBe('https://github.com/bluescript-lang/pkg-led-esp32.git');
    });

    it('should install packages with circle dependencies', async () => {
        // Install led and led depends on gpio, gpio depends on led.
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        createDummyProject(projectRoot);
        mockedExec.mockImplementation((command) => {
            if (command.startsWith('git clone')) {
                if (command.includes('led')) {
                    dummyGitClone(command, {
                        'pkg-gpio-esp32-project': 'https://github.com/bluescript-lang/pkg-gpio-esp32.git'
                    });
                } else if (command.includes('gpio')) {
                    dummyGitClone(command, {
                        'pkg-led-esp32-project': 'https://github.com/bluescript-lang/pkg-led-esp32.git'
                    });
                }
            }
        });
        
        // --- Act ---
        await handleInstallCommand('https://github.com/bluescript-lang/pkg-led-esp32.git', {});

        // --- Assert ---
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-led-esp32-project')));
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-gpio-esp32-project')));
        expect(getProjectConfig(projectRoot).dependencies['pkg-led-esp32-project']).toBe('https://github.com/bluescript-lang/pkg-led-esp32.git');
    });

    it('should install all packages', async () => {
        // --- Arrange ---
        setupGlobalEnvWithEsp32();
        createDummyProject(projectRoot, {
            'pkg-led-esp32-project': 'https://github.com/bluescript-lang/pkg-led-esp32.git',
            'pkg-pwm-esp32-project': 'https://github.com/bluescript-lang/pkg-pwm-esp32.git#v1.0.0',
        });
        mockedExec.mockImplementation((command) => {
            if (command.startsWith('git clone')) {
                if (command.includes('led')) {
                    dummyGitClone(command, {
                        'pkg-gpio-esp32-project': 'https://github.com/bluescript-lang/pkg-gpio-esp32.git'
                    });
                } else if (command.includes('gpio')) {
                    dummyGitClone(command, {});
                } else if (command.includes('pwm')) {
                    dummyGitClone(command, {});
                }
            }
        });
        
        // --- Act ---
        await handleInstallCommand('https://github.com/bluescript-lang/pkg-led-esp32.git', {});

        // --- Assert ---
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-led-esp32-project')));
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-gpio-esp32-project')));
        expect(fs.exists(path.join(PROJECT_PATHS.PACKAGES_DIR(projectRoot), 'pkg-pwm-esp32-project')));
    });

    it('should exit with an error if the environment of the specified board is not set up', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupDefaultGlobalEnv();
        createDummyProject(projectRoot);
        mockedExec.mockImplementation((command) => {
            if (command.startsWith('git clone')) {
                dummyGitClone(command, {});
            }
        });
        
        // --- Act ---
        await handleInstallCommand('https://github.com/bluescript-lang/pkg-gpio-esp32.git', {});

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to install https://github.com/bluescript-lang/pkg-gpio-esp32.git.');
        expect(mockedShowErrorMessages).toHaveBeenCalledWith(new Error('The environment for esp32 is not set up.'));
        expect(process.exit).toHaveBeenCalled();

        // --- Clean up ---
        exitSpy.mockRestore();
    });
});


function dummyGitClone(command: string, dependencies: {[name: string]: string}) {
    const urlRegex = /(https?:\/\/\S+|git@\S+)/;
    const match = command.match(urlRegex);

    if (!match) {
        console.error("Could not find git url.");
        return null;
    }

    const fullUrl = match[0];
    const cleanUrl = fullUrl.replace(/\.git$/, '');
    const repoName = cleanUrl.split('/').pop() || '';

    const urlIndex = command.indexOf(fullUrl);
    const textAfterUrl = command.substring(urlIndex + fullUrl.length).trim();
    const targetDir = textAfterUrl.length > 0 ? textAfterUrl : repoName;

    fs.makeDir(targetDir);
    const bsConfig = {
        projectName: `${repoName}-project`,
        version: "1.0.0",
        vmVersion: "2.0.0",
        deviceName: "BLUESCRIPT",
        dependencies,
        boardName: "esp32",
        espIdfComponents: []
    };
    fs.writeFile(PROJECT_PATHS.CONFIG_FILE(targetDir), JSON.stringify(bsConfig, null, 2));
}

function createDummyProject(projectRoot: string, dependencies: {[name: string]: string} = {}) {
    fs.makeDir(projectRoot);
    const bsConfig = {
        projectName: 'test-project',
        version: "1.0.0",
        vmVersion: "2.0.0",
        deviceName: "BLUESCRIPT",
        dependencies,
        boardName: "esp32",
        espIdfComponents: []
    };
    fs.writeFile(PROJECT_PATHS.CONFIG_FILE(projectRoot), JSON.stringify(bsConfig, null, 2));
}

function getProjectConfig(projectRoot: string) {
    return JSON.parse(fs.readFile(PROJECT_PATHS.CONFIG_FILE(projectRoot)));
}

function deleteDummyProject(projectRoot: string) {
    if (fs.exists(projectRoot)) {
        fs.removeDir(projectRoot);
    }
}
