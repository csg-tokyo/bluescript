import * as os from 'os';
import { Esp32Env, Esp32DarwinEnv } from './esp32-env';
import { BaseBoardEnv } from './base-env';
import { BoardName } from '../../config/board-utils';
import { HostEnv, HostDarwinEnv } from './host-env';

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
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    if (board === 'host') {
        if (osType === 'darwin')
            return new HostDarwinEnv();
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    throw new Error(`Unsupported board name: ${board}`);
}

export { BaseBoardEnv, Esp32Env, Esp32DarwinEnv, HostEnv, HostDarwinEnv };
