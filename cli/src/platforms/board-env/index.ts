import * as os from 'os';
import { Esp32Env, Esp32DarwinEnv, Esp32WindowsEnv } from './esp32-env';
import { CommonBoardEnv, BoardEnv } from './common-env';
import { BoardName } from '../../config/board-utils';
import { HostEnv, HostDarwinEnv, HostWindowsEnv } from './host-env';


type BoardEnvMap = {
    esp32: Esp32Env;
    host: HostEnv;
};

export function createBoardEnv<B extends BoardName>(board: B): BoardEnvMap[B];
export function createBoardEnv(board: BoardName): BoardEnvMap[BoardName] {
    const osType = os.platform();
    if (board === 'esp32') {
        if (osType === 'darwin')
            return new Esp32DarwinEnv();
        if (osType === 'win32')
            return new Esp32WindowsEnv();
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    if (board === 'host') {
        if (osType === 'darwin')
            return new HostDarwinEnv();
        if (osType === 'win32')
            return new HostWindowsEnv();
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    throw new Error(`Unsupported board name: ${board}`);
}

export {
    CommonBoardEnv,
    BoardEnv,
    Esp32Env,
    Esp32DarwinEnv,
    Esp32WindowsEnv,
    HostEnv,
    HostDarwinEnv,
    HostWindowsEnv,
};
