import { z } from 'zod';
import * as path from 'path';
import * as fs from './fs';
import { BoardName } from './board-utils';


const PROJECT_CONFIG_FILE_NAME = 'bsconfig.json';
const DEFAULT_DEVICE_NAME = 'BLUESCRIPT';


const baseConfigSchema = z.object({
    projectName: z.string(),
    version: z.string().default('1.0.0'),
    deviceName: z.string().default(DEFAULT_DEVICE_NAME),
    dependencies: z.array(z.string()).default([]),
});

const esp32ProjectSchema = baseConfigSchema.extend({
    boardName: z.literal('esp32'),
    espIdfComponents: z.array(z.string()).default([]),
});

const projectConfigSchema = z.discriminatedUnion('boardName', [
    esp32ProjectSchema,
]);

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export class ProjectConfigHandler {
    config?: ProjectConfig;

    readFromFile(dir: string) {
        try {
            const fileContent = fs.readFile(path.join(dir, PROJECT_CONFIG_FILE_NAME));
            const json = JSON.parse(fileContent);
            this.config = projectConfigSchema.parse(json);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Failed to read project config due to validation error.`, { cause: error });
            }
            throw new Error(`Failed to read project config.`, {cause: error});
        }
    }

    set(config: ProjectConfig) {
        try {
            this.config = projectConfigSchema.parse(config);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Failed to set project config due to validation error.`, { cause: error });
            }
            throw new Error(`Failed to set project config.`, {cause: error});
        }
    }

    save(dir: string) {
        try {
            const validatedConfig = projectConfigSchema.parse(this.config);
            const data = JSON.stringify(validatedConfig, null, 2);
            fs.writeFile(path.join(dir, PROJECT_CONFIG_FILE_NAME), data);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Failed to save project config due to validation error.`, { cause: error });
            }
            throw new Error(`Failed to save project config to ${path}.`, {cause: error});
        }
    }

    getTemplate(projectName: string, board: BoardName): ProjectConfig {
        const baseTemplate = {projectName};
        switch (board) {
            case 'esp32':
                return esp32ProjectSchema.parse({
                    ...baseTemplate,
                    boardName: 'esp32',
                });
            default:
                const _: never = board;
                throw new Error(`Unsupported board name: ${_}`);
        }
    }
}
