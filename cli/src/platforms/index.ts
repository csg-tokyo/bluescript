import { GlobalConfigHandler } from "../config/global-config";
import { ProjectConfigHandler } from "../config/project-config";
import { BoardName } from "../config/board-utils";
import { ProgramOutput } from "../core/program-output";
import { CompilerAdapter } from "./compiler/compiler-adapter";
import { Esp32CompilerAdapter } from "./compiler/esp32-compiler-adapter";
import { BoardRuntime } from "./runtime/board-runtime";
import { Esp32BoardRuntime } from "./runtime/esp32-board-runtime";

export { CompilerAdapter, CompileContext } from "./compiler/compiler-adapter";
export { BoardRuntime } from "./runtime/board-runtime";

export function getCompilerAdapter(
    boardName: BoardName,
    globalConfigHandler: GlobalConfigHandler,
    projectConfigHandler: ProjectConfigHandler,
): CompilerAdapter {
    if (boardName === 'esp32') {
        return new Esp32CompilerAdapter(globalConfigHandler, projectConfigHandler);
    }
    throw new Error(`Unsupported board name: ${boardName}`);
}

export function getBoardRuntime(
    boardName: BoardName,
    deviceName: string,
    programOutput: ProgramOutput,
    onUnexpectedDisconnect?: () => void,
): BoardRuntime {
    if (boardName === 'esp32') {
        return new Esp32BoardRuntime(deviceName, programOutput, onUnexpectedDisconnect);
    }
    throw new Error(`Unsupported board name: ${boardName}`);
}

export function createPlatformSession(
    boardName: BoardName,
    globalConfigHandler: GlobalConfigHandler,
    projectConfigHandler: ProjectConfigHandler,
    deviceName: string,
    programOutput: ProgramOutput,
    onUnexpectedDisconnect?: () => void,
): { compiler: CompilerAdapter; runtime: BoardRuntime } {
    return {
        compiler: getCompilerAdapter(boardName, globalConfigHandler, projectConfigHandler),
        runtime: getBoardRuntime(boardName, deviceName, programOutput, onUnexpectedDisconnect),
    };
}
