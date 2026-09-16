export const BOARD_NAMES = ['esp32', 'esp32s3', 'host'] as const;
export type BoardName = (typeof BOARD_NAMES)[number];
export const isValidBoard = (board: string): board is BoardName => (BOARD_NAMES as readonly string[]).includes(board);

// Boards of the ESP32 family. They share the same ESP-IDF installation and the
// same runtime port (microcontroller/ports/esp32), but use different chip targets.
export const ESP32_FAMILY_BOARD_NAMES = ['esp32', 'esp32s3'] as const;
export type Esp32FamilyBoardName = (typeof ESP32_FAMILY_BOARD_NAMES)[number];
export const isEsp32FamilyBoard = (board: string): board is Esp32FamilyBoardName =>
    (ESP32_FAMILY_BOARD_NAMES as readonly string[]).includes(board);
