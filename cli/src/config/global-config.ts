import { z } from 'zod';
import * as fs from '../core/fs';
import { BoardName } from './board-utils';
import { GLOBAL_SETTINGS } from './constants';


const esp32BoardSchema = z.object({
    idfVersion: z.string(),
    rootDir: z.string(),
    exportFile: z.string(),
    xtensaGccDir: z.string(),
});

const boardConfigSchema = z.object({
    esp32: esp32BoardSchema.optional(),
});

const globalConfigSchema = z.object({
    version: z.string(),
    runtimeDir: z.string().optional(),
    boards: boardConfigSchema.default({}),
});

export type Esp32BoardConfig = z.infer<typeof esp32BoardSchema>;
export type BoardConfig = z.infer<typeof boardConfigSchema>;
export type GlobalConfig = z.infer<typeof globalConfigSchema>;

export class GlobalConfigHandler {
    private config: GlobalConfig;

    private constructor(config: GlobalConfig) {
        this.config = config;
    }

    static load() {
        if (!fs.exists(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE)) {
            return new GlobalConfigHandler(globalConfigSchema.parse({version: GLOBAL_SETTINGS.VM_VERSION}));
        }
        try {
            const fileContent = fs.readFile(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE);
            const json = JSON.parse(fileContent);
            const parsedConfig = globalConfigSchema.parse(json);
            return new GlobalConfigHandler(parsedConfig);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Global config validation failed.`, { cause: error });
            }
            throw new Error(`Failed to load global config.`, {cause: error});
        }
    }

    static fromObject(obj: GlobalConfig): GlobalConfigHandler {
        try {
            const parsedConfig = globalConfigSchema.parse(obj);
            return new GlobalConfigHandler(parsedConfig);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Global config object validation failed.`, { cause: error });
            }
            throw error;
        }
    }

    update(config: Partial<GlobalConfig>) {
        try {
            this.config = globalConfigSchema.parse({
                ...this.config,
                ...config,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Global config validation failed.`, { cause: error });
            }
            throw error;
        }
    }

    save() {
        try {
            fs.makeDir(GLOBAL_SETTINGS.BLUESCRIPT_DIR);
            const data = JSON.stringify(this.config, null, 2);
            fs.writeFile(GLOBAL_SETTINGS.BLUESCRIPT_CONFIG_FILE, data);
        } catch (error) {
            throw new Error(`Failed to save global config.`, {cause: error});
        }
    }

    isRuntimeSetup() {
        return this.config.runtimeDir !== undefined;
    }

    setRuntimeDir(dir: string) {
        this.update({runtimeDir: dir});
    }

    setVersion(version: string) {
        this.update({version});
    }

    getConfig(): Readonly<GlobalConfig> {
        return this.config;
    }

    // Handle board config

    isBoardSetup<K extends keyof BoardConfig>(boardName: K): boolean {
        return !!this.config.boards?.[boardName];
    }

    getBoardConfig<K extends keyof BoardConfig>(boardName: K): Readonly<BoardConfig[K]> | undefined {
        return this.config.boards?.[boardName];
    }

    updateBoardConfig<K extends keyof BoardConfig>(boardName: K, boardConfig: Partial<BoardConfig[K]>) {
        const existingBoardConfig = this.config.boards[boardName] ?? {};
        const mergedBoardConfig = {
            ...existingBoardConfig,
            ...boardConfig
        };
        this.update({
            boards: {
                ...this.config.boards,
                [boardName]: mergedBoardConfig
            }
        });
    }

    removeBoardConfig<K extends keyof BoardConfig>(boardName: K) {
        if (boardName in this.config.boards) {
            delete this.config.boards[boardName];
        }
    }

    getAvailableBoards(): BoardName[] {
        const boardNames = Object.keys(this.config.boards);
        return boardNames as BoardName[];
    }
}

