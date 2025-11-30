import { GLOBAL_BLUESCRIPT_PATH, GlobalConfigHandler, VM_VERSION } from '../../src/config/global-config';
import * as fs from '../../src/core/fs';
import * as path from 'path';

export const mockedFs = fs as jest.Mocked<typeof fs>;

describe('GlobalConfigHandler', () => {
    it('shold load default confgi if there is no config file', () => {
        // --- Arrange ---
        mockedFs.exists.mockReturnValue(false);

        // --- Act ---
        const handler = GlobalConfigHandler.load();

        // --- Assert ---
        expect(handler.getConfig()).toEqual({
            version: VM_VERSION,
            boards: {}
        });
    });

    it('should save object to file', () => {
        // --- Arrange ---
        mockedFs.exists.mockReturnValue(false);

        // --- Act ---
        const handler = GlobalConfigHandler.load();
        handler.save();

        // --- Assert ---
        expect(mockedFs.writeFile).toHaveBeenCalledWith(path.join(GLOBAL_BLUESCRIPT_PATH, 'config.json'), expect.any(String));
    });

    it('should update board config', () => {
        // --- Arrange ---
        mockedFs.exists.mockReturnValue(false);

        // --- Act ---
        const boardConfig = {
            idfVersion: 'v5.4',
            rootDir: 'root/dir',
            exportFile: 'export.sh',
            xtensaGccDir:'gcc',
        }
        const handler = GlobalConfigHandler.load();
        handler.updateBoardConfig('esp32', boardConfig);

        // --- Assert ---
        expect(handler.getConfig()).toEqual({
            version: VM_VERSION,
            boards: {
                esp32: boardConfig
            }
        });
    });
})