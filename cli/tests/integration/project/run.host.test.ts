jest.mock('../../../src/core/shell', () => ({
    ...jest.requireActual('../../../src/core/shell'),
    cwd: jest.fn(),
}));

import * as path from 'path';
import { cwd } from '../../../src/core/shell';
import * as fs from '../../../src/core/fs';
import { handleRunCommand } from '../../../src/commands/project/run';
import { buildHostRuntime } from '../../../src/platforms/runtime/host-board-runtime';
import {
    deleteGlobalEnv,
    setupGlobalEnvWithHostIntegration,
    spyGlobalSettings,
} from '../../commands/global-env-helper';
import {
    captureStdout,
    createHostProject,
    mockProcessExit,
    removeDirIfExists,
} from '../host-run-helper';

const mockedCwd = cwd as jest.Mock;

const TEMP_DIR = path.join(__dirname, '../../../temp-files/integration');
const RUNTIME_DIR = path.resolve(__dirname, '../../../../microcontroller');
const BUILD_DIR = path.join(RUNTIME_DIR, 'ports/host/build');
const PROJECT_ROOT = path.join(TEMP_DIR, 'run-project');
const SHELL_PATH = path.join(BUILD_DIR, 'shell');
const RUNTIME_SO_PATH = path.join(BUILD_DIR, 'c-runtime.so');

const describeHost = process.platform === 'darwin' ? describe : describe.skip;

describeHost('project run command (host integration)', () => {
    beforeAll(async () => {
        spyGlobalSettings('run-integration');
        fs.makeDir(TEMP_DIR);

        if (!fs.exists(SHELL_PATH) || !fs.exists(RUNTIME_SO_PATH)) {
            await buildHostRuntime(RUNTIME_DIR, BUILD_DIR);
        }
    });

    beforeEach(() => {
        deleteGlobalEnv();
        setupGlobalEnvWithHostIntegration(RUNTIME_DIR, BUILD_DIR);
        removeDirIfExists(PROJECT_ROOT);
        fs.makeDir(PROJECT_ROOT);
        mockedCwd.mockReturnValue(PROJECT_ROOT);
    });

    afterAll(() => {
        deleteGlobalEnv();
        removeDirIfExists(TEMP_DIR);
    });

    it('runs a program and prints output', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/index.bs': 'console.log("hello from run");',
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toContain('hello from run');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program using the built-in library', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/index.bs': `
console.log("built-in");
print("via print");
console.log(time.now());
            `.trim(),
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toContain('built-in');
        expect(stdout.text()).toContain('via print');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program with user-defined functions and variables', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/index.bs': `
const message = "hello";
function greet(): void {
    console.log(message);
}
greet();
            `.trim(),
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toContain('hello');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program with a local module import', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/math-utils.bs': `
export function add(a: integer, b: integer): integer {
    return a + b;
}
            `.trim(),
            'src/index.bs': `
import { add } from "./math-utils";
console.log(add(10, 20));
            `.trim(),
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toContain('30');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program with a package import', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/index.bs': `
import { mul } from "math-lib";
console.log(mul(3, 4));
            `.trim(),
        }, RUNTIME_DIR, 'test-run', [{
            name: 'math-lib',
            sources: {
                'src/index.bs': `
export function mul(a: integer, b: integer): integer {
    return a * b;
}
                `.trim(),
            },
        }]);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toContain('12');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program using inline C', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/index.bs': `
code\`#include <math.h>\`

function pow(x: float, y: float): float {
    let result: float;
    code\`\${result} = (float)pow(\${x}, \${y});\`;
    return result;
}

console.log(pow(2.0, 3.0));
            `.trim(),
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toMatch(/8(\.0+)?/);

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program that includes a C file', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/add.c': 'int add(int a, int b) { return a + b; }',
            'src/index.bs': `
code\`#include "./add.c"\`

function main(): void {
    let result: integer = 0;
    code\`\${result} = add(10, 20);\`;
    console.log(result);
}

main();
            `.trim(),
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toContain('30');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program that includes a header file', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/add.h': 'int add(int a, int b);',
            'src/add.c': '#include "add.h"\nint add(int a, int b) { return a + b; }',
            'src/index.bs': `
code\`#include "add.h"\`

function main(): void {
    let result: integer = 0;
    code\`\${result} = add(5, 6);\`;
    console.log(result);
}

main();
            `.trim(),
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(stdout.text()).toContain('11');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('exits with an error when compilation fails', async () => {
        const exitSpy = mockProcessExit();

        createHostProject(PROJECT_ROOT, {
            'src/index.bs': 'this is not valid bluescript',
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
    });
});
