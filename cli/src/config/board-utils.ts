export const BOARD_NAMES = ['esp32'] as const;
export type BoardName = (typeof BOARD_NAMES)[number];
export const isValidBoard = (board: string): board is BoardName => (BOARD_NAMES as readonly string[]).includes(board);
