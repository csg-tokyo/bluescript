import { GlobalConfigHandler } from "../../config/global-config";
import { DEFAULT_DEVICE_NAME } from "../../config/project-config";
import { BoardName } from "../../config/board-utils";
import { ProgramOutput } from "../../core/logger/program-output";
import { BoardRuntime } from "../runtime/board-runtime";
import { Esp32BoardRuntime } from "../runtime/esp32-board-runtime";
import { HostBoardRuntime } from "../runtime/host-board-runtime";

export { BoardRuntime } from "../runtime/board-runtime";


export function getBoardRuntime(
    boardName: BoardName,
    globalConfigHandler: GlobalConfigHandler,
    programOutput: ProgramOutput,
    deviceName?: string,
    onUnexpectedDisconnect?: () => void,
): BoardRuntime {
    if (boardName === 'esp32') {
        const _deviceName = deviceName ?? DEFAULT_DEVICE_NAME;
        return new Esp32BoardRuntime(_deviceName, programOutput, onUnexpectedDisconnect);
    }
    if (boardName === 'host') {
        const boardConfig = globalConfigHandler.getBoardConfig('host');
        if (!boardConfig) {
            throw new Error('The environment for host is not set up.');
        }
        return new HostBoardRuntime(boardConfig, programOutput, onUnexpectedDisconnect);
    }
    throw new Error(`Unsupported board name: ${boardName}`);
}
