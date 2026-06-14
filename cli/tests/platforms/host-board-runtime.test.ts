import * as path from 'path';
import { EventEmitter } from 'events';
import { HostBoardRuntime } from '../../src/platforms/runtime/host-board-runtime';
import * as fs from '../../src/core/fs';

jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

import { spawn } from 'child_process';

const mockedSpawn = spawn as jest.Mock;

class MockChildProcess extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    kill = jest.fn();
}

describe('HostBoardRuntime', () => {
    const buildDir = path.join(__dirname, '../../temp-files/host-runtime-test');
    const boardConfig = { buildDir };
    const programOutput = {
        write: jest.fn(),
        writeError: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        fs.makeDir(buildDir, true);
        fs.writeFile(path.join(buildDir, 'runner'), '');
        fs.writeFile(path.join(buildDir, 'c-runtime.so'), '');
    });

    afterEach(() => {
        if (fs.exists(buildDir)) {
            fs.removeDir(buildDir);
        }
    });

    it('should spawn runner with shared object path and entry symbols', async () => {
        const child = new MockChildProcess();
        mockedSpawn.mockReturnValue(child);
        const runtime = new HostBoardRuntime(boardConfig, programOutput);

        await runtime.connect();
        await runtime.load({
            soFile: '/project/dist/build/app.so',
            entryNames: [{ isMain: true, name: 'app' }],
        });

        const executePromise = runtime.execute({
            soFile: '/project/dist/build/app.so',
            entryNames: [{ isMain: true, name: 'app' }],
        });
        child.emit('close', 0);
        await executePromise;

        expect(mockedSpawn).toHaveBeenCalledWith(
            path.join(buildDir, 'runner'),
            ['/project/dist/build/app.so', 'app'],
            { stdio: ['ignore', 'pipe', 'pipe'] },
        );
    });

    it('should forward stdout and stderr to program output', async () => {
        const child = new MockChildProcess();
        mockedSpawn.mockReturnValue(child);
        const runtime = new HostBoardRuntime(boardConfig, programOutput);

        await runtime.connect();
        const executePromise = runtime.execute({
            soFile: '/project/dist/build/app.so',
            entryNames: [{ isMain: true, name: 'app' }],
        });
        child.stdout.emit('data', Buffer.from('hello\n'));
        child.stderr.emit('data', Buffer.from('oops\n'));
        child.emit('close', 0);
        await executePromise;

        expect(programOutput.write).toHaveBeenCalledWith('hello\n');
        expect(programOutput.writeError).toHaveBeenCalledWith('oops\n');
    });
});
