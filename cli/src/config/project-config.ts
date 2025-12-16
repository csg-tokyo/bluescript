import { z } from 'zod';
import * as path from 'path';
import * as fs from '../core/fs';
import { BoardName } from './board-utils';
import { VM_VERSION } from './global-config';


const PROJECT_CONFIG_FILE_NAME = 'bsconfig.json';
const DEfAULT_PROJECT_VERSION = '1.0.0';
export const DEFAULT_DEVICE_NAME = 'BLUESCRIPT';

export const DEFAULT_MAIN_FILE_NAME = 'index.bs';
export const DIST_DIR = (root: string) => path.join(root, 'dist');
export const BUILD_DIR = (root: string) => path.join(root, 'dist/build');
export const LOCAL_PACKAGES_DIR = (root: string) => path.join(root, 'packages');


const baseConfigSchema = z.object({
    projectName: z.string(),
    version: z.string().default(DEfAULT_PROJECT_VERSION),
    vmVersion: z.string().default(VM_VERSION),
    deviceName: z.string().default(DEFAULT_DEVICE_NAME).optional(),
    dependencies: z.record(z.string(), z.string()).default({}),
    runtimeDir: z.string().optional(), // for dev
    globalPackagesDir: z.string().optional(), // for dev
});

const esp32ProjectSchema = baseConfigSchema.extend({
    boardName: z.literal('esp32'),
    espIdfComponents: z.array(z.string()).default([]),
});

const projectConfigSchema = z.discriminatedUnion('boardName', [
    esp32ProjectSchema,
]);

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export type SpecificBoardConfig<B extends BoardName> = Extract<ProjectConfig, { boardName: B }>;

export type PackageSource = {
    name: string,
    url: string,
    version?: string
};

export class ProjectConfigHandler {
    private config: ProjectConfig;

    private constructor(config: ProjectConfig) {
        this.config = config;
    }

    public static load(dir: string): ProjectConfigHandler {
        const filePath = path.join(dir, PROJECT_CONFIG_FILE_NAME);
        try {
            const fileContent = fs.readFile(filePath);
            const json = JSON.parse(fileContent);
            const parsedConfig = projectConfigSchema.parse(json);
            return new ProjectConfigHandler(parsedConfig);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Project config validation failed in ${filePath}.`, { cause: error });
            }
            throw new Error(`Failed to load project config from ${filePath}.`, { cause: error });
        }
    }

    public static fromObject(obj: ProjectConfig): ProjectConfigHandler {
        try {
            const parsedConfig = projectConfigSchema.parse(obj);
            return new ProjectConfigHandler(parsedConfig);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Project config object validation failed.`, { cause: error });
            }
            throw error;
        }
    }

    public static createTemplate(projectName: string, board: BoardName): ProjectConfigHandler {
        const template = {
            projectName,
            boardName: board,
        };
        const parsedConfig = projectConfigSchema.parse(template);
        return new ProjectConfigHandler(parsedConfig);
    }

    public getConfig(): Readonly<ProjectConfig> {
        return this.config;
    }

    public checkVmVersion(expected: string) {
        if (expected !== this.config.vmVersion) {
            throw new Error(`VM version of ${this.config.projectName} is not match the expected VM version(${expected}).`);
        }
    }

    public getBoardName(): BoardName {
        return this.config.boardName;
    }

    public asBoard<B extends BoardName>(expectedBoardName: B): SpecificBoardConfig<B> {
        if (this.config.boardName !== expectedBoardName) {
            throw new Error(
                `Configuration mismatch: Expected board '${expectedBoardName}', but found '${this.config.boardName}'.`
            );
        }
        return this.config as SpecificBoardConfig<B>;
    }

    public update(config: Partial<ProjectConfig>) {
        try {
            this.config = projectConfigSchema.parse({
                ...this.config,
                ...config
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`Project config validation failed.`, { cause: error });
            }
            throw error;
        }
    }

    public addDependency(source: PackageSource) {
        const newDependencies = {...this.config.dependencies}
        newDependencies[source.name] = 
                source.version ? `${source.url}#${source.version}` : source.url;
        this.update({dependencies: newDependencies});
    }

    public removeDepedency(name: string) {
        const newDependencies = {...this.config.dependencies};
        delete newDependencies[name];
        this.update({dependencies: newDependencies});
    }

    public dependencyExists(name: string) {
        return Object.keys(this.config.dependencies).includes(name);
    }

    public getDepenencies(): PackageSource[] {
        return Object.keys(this.config.dependencies).map(name => {
            const depString = this.config.dependencies[name];
            let url = depString;
            let version: string | undefined = undefined;

            // #extract tag (git-url#commit-ish)
            if (depString.includes('#')) {
                const parts = depString.split('#');
                url = parts[0];
                version = parts[1];
            }
            return {name, url, version};
        });
    }

    public save(dir: string): void {
        try {
            const data = JSON.stringify(this.config, null, 2);
            fs.writeFile(path.join(dir, PROJECT_CONFIG_FILE_NAME), data);
        } catch (error) {
            throw new Error(`Failed to save project config to ${dir}.`, { cause: error });
        }
    }
}
