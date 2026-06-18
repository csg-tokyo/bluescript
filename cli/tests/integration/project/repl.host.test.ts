jest.mock('../../../src/core/shell', () => ({
    ...jest.requireActual('../../../src/core/shell'),
    cwd: jest.fn(),
}));

import * as readline from 'readline';
import * as path from 'path';
import * as fs from '../../../src/core/fs';
import { handleReplCommand } from '../../../src/commands/repl';
import { logger } from '../../../src/core/logger';
import { buildHostRuntime } from '../../../src/platforms/runtime/host-board-runtime';
import {
    deleteGlobalEnv,
    setupGlobalEnvWithHostIntegration,
    spyGlobalSettings,
} from '../../commands/global-env-helper';
import {
    captureOutput,
    HOST_INTEGRATION_BUILD_DIR,
    HOST_INTEGRATION_RUNTIME_DIR,
    mockProcessExit,
    removeDirIfExists,
    waitFor,
    waitForStdoutContains,
} from '../host-run-helper';

const TEMP_DIR = path.join(__dirname, '../../../temp-files/integration-repl');
const SHELL_PATH = path.join(HOST_INTEGRATION_BUILD_DIR, 'shell');
const RUNTIME_SO_PATH = path.join(HOST_INTEGRATION_BUILD_DIR, 'c-runtime.so');

const describeHost = process.platform === 'darwin' ? describe : describe.skip;

let replLineHandler: ((line: string) => void) | undefined;
let replCloseHandler: (() => void) | undefined;

function createMockReadline(): readline.Interface {
    return {
        prompt: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        on: jest.fn((event: string, handler: (...args: never[]) => void) => {
            if (event === 'line') {
                replLineHandler = handler as (line: string) => void;
            }
            if (event === 'close') {
                replCloseHandler = handler as () => void;
            }
        }),
        close: jest.fn(() => {
            replCloseHandler?.();
        }),
    } as unknown as readline.Interface;
}

describeHost('repl command (host integration)', () => {
    jest.setTimeout(30000);

    beforeAll(async () => {
        spyGlobalSettings('repl-integration');
        fs.makeDir(TEMP_DIR);

        if (!fs.exists(SHELL_PATH) || !fs.exists(RUNTIME_SO_PATH)) {
            await buildHostRuntime(HOST_INTEGRATION_RUNTIME_DIR, HOST_INTEGRATION_BUILD_DIR);
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
        setupGlobalEnvWithHostIntegration(
            HOST_INTEGRATION_RUNTIME_DIR,
            HOST_INTEGRATION_BUILD_DIR,
        );
        replLineHandler = undefined;
        replCloseHandler = undefined;
    });

    afterAll(() => {
        deleteGlobalEnv();
        removeDirIfExists(TEMP_DIR);
    });

    async function sendReplLine(
        line: string,
        output: ReturnType<typeof captureOutput>,
        expectedOutput?: string,
    ) {
        if (!replLineHandler) {
            throw new Error('REPL line handler is not ready');
        }
        replLineHandler(line);
        if (expectedOutput) {
            await waitForStdoutContains(output, expectedOutput);
        } else {
            await new Promise((resolve) => setTimeout(resolve, 800));
        }
    }

    async function closeRepl() {
        if (!replCloseHandler) {
            throw new Error('REPL close handler is not ready');
        }
        replCloseHandler();
    }

    async function startReplSession() {
        const exitSpy = mockProcessExit();
        const output = captureOutput();
        const replPromise = handleReplCommand(
            { board: 'host' },
            { createReadline: createMockReadline },
        );
        await waitFor(() => replLineHandler !== undefined);
        return { exitSpy, output, replPromise };
    }

    it('executes the first REPL line as the entry program', async () => {
        const { exitSpy, output, replPromise } = await startReplSession();

        await sendReplLine('console.log("repl entry");', output, 'repl entry');
        await closeRepl();
        await replPromise;

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(output.text()).toContain('repl entry');

        output.restore();
        exitSpy.mockRestore();
    });

    it('executes built-in library calls in REPL lines', async () => {
        const { exitSpy, output, replPromise } = await startReplSession();

        await sendReplLine('console.log("init");', output, 'init');
        await sendReplLine('print("via print");', output, 'via print');
        await closeRepl();
        await replPromise;

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(output.text()).toContain('init');
        expect(output.text()).toContain('via print');

        output.restore();
        exitSpy.mockRestore();
    });

    it('keeps variables available across REPL lines', async () => {
        const { exitSpy, output, replPromise } = await startReplSession();

        await sendReplLine('const x = 42; console.log("init");', output, 'init');
        await sendReplLine('console.log(x);', output, '42');
        await closeRepl();
        await replPromise;

        expect(exitSpy).toHaveBeenCalledWith(0);

        output.restore();
        exitSpy.mockRestore();
    });

    it('keeps functions available across REPL lines', async () => {
        const { exitSpy, output, replPromise } = await startReplSession();

        await sendReplLine(
            'function double(n: integer): integer { return n * 2; } console.log("fn defined");',
            output,
            'fn defined',
        );
        await sendReplLine('console.log(double(21));', output, '42');
        await closeRepl();
        await replPromise;

        expect(exitSpy).toHaveBeenCalledWith(0);

        output.restore();
        exitSpy.mockRestore();
    });

    it('continues REPL after a compile error', async () => {
        const { exitSpy, output, replPromise } = await startReplSession();

        await sendReplLine('this is not valid bluescript', output);
        await waitFor(() =>
            (logger.error as jest.Mock).mock.calls.some(([message]) =>
                String(message).includes('** compile error:'),
            ),
        );

        await sendReplLine('console.log("after error");', output, 'after error');
        await closeRepl();
        await replPromise;

        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(output.text()).toContain('after error');

        output.restore();
        exitSpy.mockRestore();
    });
});
