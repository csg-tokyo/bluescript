import { BoardName } from "../config/board-utils";

export type PipelineLabels = {
    connect: string;
    prepare: string;
    disconnectError: string;
};

export function getPipelineLabels(boardName: BoardName): PipelineLabels {
    if (boardName === 'host') {
        return {
            connect: 'Connecting to runtime process...',
            prepare: 'Initializing runtime process...',
            disconnectError: 'Runtime process exited.',
        };
    }
    return {
        connect: 'Connecting via BLE...',
        prepare: 'Initializing Device...',
        disconnectError: 'BLE disconnected.',
    };
}
