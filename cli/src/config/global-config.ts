import { z } from 'zod';
import * as os from 'os';
import * as path from 'path';
import * as fs from '../core/fs';
import { BoardName } from './board-utils';


const DEFAULT_BLUESCRIPT_VERSION = '1.0.0';
const BLUESCRIPT_DIR_NAME = '.bluescript';
const GLOBAL_CONFIG_FILE_NAME = 'config.json';

export const GLOBAL_BLUESCRIPT_PATH = path.join(os.homedir(), BLUESCRIPT_DIR_NAME);
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_BLUESCRIPT_PATH, GLOBAL_CONFIG_FILE_NAME);

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
    version: z.string().default(DEFAULT_BLUESCRIPT_VERSION),
    runtime: z.object({
        version: z.string(),
        dir: z.string(),
    }).optional(),
    globalPackagesDir: z.string().optional(),
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
        if (!fs.exists(GLOBAL_CONFIG_PATH)) {
            return new GlobalConfigHandler(globalConfigSchema.parse({}));
        }
        try {
            const fileContent = fs.readFile(GLOBAL_CONFIG_PATH);
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
            fs.makeDir(GLOBAL_BLUESCRIPT_PATH);
            const data = JSON.stringify(this.config, null, 2);
            fs.writeFile(GLOBAL_CONFIG_PATH, data);
        } catch (error) {
            throw new Error(`Failed to save global config.`, {cause: error});
        }
    }

    isRuntimeSetup() {
        return this.config.runtime !== undefined;
    }

    setRuntime(version: string, dir: string) {
        this.update({runtime: {version, dir}});
    }

    isGlobalPackagesSetup() {
        return this.config.globalPackagesDir !== undefined;
    }

    setGlobalPackagesDir(dir: string) {
        this.update({globalPackagesDir: dir});
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

