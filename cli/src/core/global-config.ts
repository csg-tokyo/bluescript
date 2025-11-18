import { z } from 'zod';
import * as os from 'os';
import * as path from 'path';
import * as fs from './fs';
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

const boardSchemaMap = {
    esp32: esp32BoardSchema,
};

export type Esp32BoardConfig = z.infer<typeof esp32BoardSchema>;
export type BoardConfig = z.infer<typeof boardConfigSchema>;
export type GlobalConfig = z.infer<typeof globalConfigSchema>;

export class GlobalConfigHandler {
    globalConfig: GlobalConfig;

    constructor() {
        this.globalConfig = this.readGlobalConfig();
    }

    updateGlobalConfig(config: Partial<GlobalConfig>) {
        const mergedConfig = {
            ...config,
            ...this.globalConfig
        };
        try {
            this.globalConfig = globalConfigSchema.parse(mergedConfig);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Invalid global config.`, { cause: error });
            }
            throw error;
        }
    }

    saveGlobalConfig() {
        try {
            fs.makeDir(GLOBAL_BLUESCRIPT_PATH);
            const validatedConfig = globalConfigSchema.parse(this.globalConfig);
            const data = JSON.stringify(validatedConfig, null, 2);
            fs.writeFile(GLOBAL_CONFIG_PATH, data);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Failed to save global config due to validation error.`, { cause: error });
            }
            throw new Error(`Failed to save global config to ${GLOBAL_CONFIG_PATH}.`, {cause: error});
        }
    }

    private readGlobalConfig(): GlobalConfig {
        if (!fs.exists(GLOBAL_CONFIG_PATH)) {
            return globalConfigSchema.parse({});
        }
        try {
            const fileContent = fs.readFile(GLOBAL_CONFIG_PATH);
            const json = JSON.parse(fileContent);
            return globalConfigSchema.parse(json);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Failed to load global config due to validation error.`, { cause: error });
            }
            throw new Error(`Failed to load global config.`, {cause: error});
        }
    }

    // Handle board config

    isBoardSetup<K extends keyof BoardConfig>(boardName: K): boolean {
        return !!this.globalConfig.boards?.[boardName];
    }

    getBoardConfig<K extends keyof BoardConfig>(boardName: K): BoardConfig[K] | undefined {
        return this.globalConfig.boards?.[boardName];
    }

    updateBoardConfig<K extends keyof BoardConfig>(boardName: K, config: Partial<BoardConfig[K]>) {
        const existingConfig = this.globalConfig.boards?.[boardName] ?? {};
        const mergedConfig = {
            ...existingConfig,
            ...config
        };
        const schema = boardSchemaMap[boardName]!;
        try {
            const validatedConfig = schema.parse(mergedConfig);
            this.globalConfig = {
                ...this.globalConfig,
                boards: {
                    ...this.globalConfig.boards,
                    [boardName]: validatedConfig
                }
            };
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Invalid configuration for board '${boardName}'.`, { cause: error });
            }
            throw error;
        }        
    }

    removeBoardConfig<K extends keyof BoardConfig>(boardName: K) {
        if (boardName in this.globalConfig.boards) {
            delete this.globalConfig.boards[boardName];
        }
    }

    getAvailableBoards(): BoardName[] {
        const boardNames = Object.keys(this.globalConfig.boards);
        return boardNames as BoardName[];
    }
}

