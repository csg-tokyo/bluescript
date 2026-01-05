import { GlobalConfigHandler } from '../../src/config/global-config';
import { GLOBAL_SETTINGS } from '../../src/config/constants';
import * as fs from '../../src/core/fs';
import { deleteGlobalEnv, getGlobalConfig, setupEmpyGlobalEnv, spyGlobalSettings } from '../commands/global-env-helper';


describe('GlobalConfigHandler', () => {
    beforeAll(() => {
        spyGlobalSettings('update');
    });

    afterEach(() => {
        deleteGlobalEnv();
    });

    it('shold load default confgi if there is no config file', () => {
        // --- Arrange ---
        setupEmpyGlobalEnv();

        // --- Act ---
        const handler = GlobalConfigHandler.load();

        // --- Assert ---
        expect(handler.getConfig()).toEqual({
            version: GLOBAL_SETTINGS.VM_VERSION,
            boards: {}
        });
    });

    it('should save object to file', () => {
        // --- Arrange ---
        setupEmpyGlobalEnv();

        // --- Act ---
        const handler = GlobalConfigHandler.load();
        handler.save();

        // --- Assert ---
        expect(fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE));
    });

    it('should update board config', () => {
        // --- Arrange ---
        setupEmpyGlobalEnv();

        // --- Act ---
        const boardConfig = {
            idfVersion: 'v5.4',
            rootDir: 'root/dir',
            exportFile: 'export.sh',
            xtensaGccDir:'gcc',
        }
        const handler = GlobalConfigHandler.load();
        handler.updateBoardConfig('esp32', boardConfig);
        handler.save();

        // --- Assert ---
        expect(getGlobalConfig()).toEqual({
            version: GLOBAL_SETTINGS.VM_VERSION,
            boards: {
                esp32: boardConfig
            }
        });
    });
})