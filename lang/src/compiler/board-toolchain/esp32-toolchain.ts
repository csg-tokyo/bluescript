import * as path from "path";
import * as fs from "fs";
import { PackageForEsp32, Project } from "../project";
import { BoardToolchain, MemoryImage, MemoryLayout, ShadowMemory } from "./board-toolchain";
import { executeCommand, getErrorMessage } from "../utils";
import generateMakefile from "./makefile";
import { ElfReader } from "./elf-reader";
import generateLinkerScript from "./linker-script";


export type Esp32ToolchainConfig = {
    runtimeDir: string,
    compilerToolchainDir: string,
    espDir: string
}

export class Esp32Toolchain implements BoardToolchain<PackageForEsp32, MemoryImage> {
    public memory: ShadowMemory;

    private config: Esp32ToolchainConfig;
    private espIdfComponents: EspIdfComponents;
    private definedSymbols: Map<string, { name: string; address: number }>; 

    get cProlog() {
        return `
#include <stdint.h>
#include "${this.cRuntimeH}"
`;
    }
    get runtimeElf() { return path.join(this.config.runtimeDir, 'ports/esp32/build/bluescript.elf'); }
    get cRuntimeH() { return path.join(this.config.runtimeDir, 'core/include/c-runtime.h'); }
    get builtinModulePath() { return path.join(this.config.runtimeDir, 'ports/esp32/std-module.bs'); }
    get ld() { return path.join(this.config.compilerToolchainDir, 'xtensa-esp32-elf-ld'); } 

    constructor(config: Esp32ToolchainConfig, memoryLayout: MemoryLayout) {
        this.memory = new ShadowMemory(memoryLayout);
        this.config = config;
        this.espIdfComponents = new EspIdfComponents(config.runtimeDir, config.espDir);

        const elfReader = new ElfReader(this.runtimeElf);
        this.definedSymbols = new Map(elfReader.readAllSymbols().map(s => [s.name, s]));
    }

    async compileAndLink(project: Project<PackageForEsp32>, entryPoints: string[]): Promise<MemoryImage> {
        const allPackages = [project.mainPackage, ...project.dependencies.filter(dep => dep.used)];
        for (const pkg of allPackages) {
            await this.compileC(project, pkg);
        }
        const elfPath = await this.link(project, entryPoints);
        return this.extractBinary(elfPath, entryPoints);
    }

    async additionalCompileAndLink(project: Project<PackageForEsp32>, entryPoints: string[]): Promise<MemoryImage> {
        await this.compileC(project, project.mainPackage);
        const elfPath = await this.link(project, entryPoints);
        return this.extractBinary(elfPath, entryPoints);
    }

    private async compileC(project: Project<PackageForEsp32>, pkg: PackageForEsp32): Promise<void> {
        try {
            const archivePath = project.archivePath(pkg);
            const includeDirs = [
                ...this.espIdfComponents.getIncludeDirs(pkg.espIdfComponents), 
                ...this.espIdfComponents.commonIncludeDirs
            ];

            // Remove old archive file.
            if (fs.existsSync(archivePath)) {
                fs.rmSync(archivePath, { force: true });
            }

            const makefile = generateMakefile(
                this.config.compilerToolchainDir, 
                pkg, includeDirs, archivePath
            );
            project.writeMakefile(pkg, makefile);
            await executeCommand('make', [], pkg.resolvedDistDir);
        } catch (error) {
            throw new Error(`Failed to compile package ${pkg.name}: ${getErrorMessage(error)}`, {cause: error});
        }
    }

    private async link(project: Project<PackageForEsp32>, entryPoints: string[]): Promise<string> {
        try {
            const cwd = process.cwd();
            const elfPath = project.elfPath();
            
            const archives = this.getArchivesWithEspComponents(project);
            const linkerscript = generateLinkerScript(
                archives.map(ar => path.relative(cwd, ar)),
                this.memory, 
                Array.from(this.definedSymbols.values()),
                entryPoints.at(-1)!, // main entry point
                entryPoints.slice(0, -1), // other entry points
                this.espIdfComponents.ldFiles
            );
            const linkerScriptPath = project.writeLinkerScript(linkerscript);
            await executeCommand(this.ld, ['-o', elfPath, '-T', linkerScriptPath, '--gc-sections'], cwd);

            return elfPath;
        } catch (error) {
            throw new Error(`Failed to link: ${getErrorMessage(error)}`, {cause: error});
        }
    }

    private extractBinary(elfPath: string, entryPoints: string[]): MemoryImage {
        const elf = new ElfReader(elfPath);

        const sections = {
            iram: elf.readSectionByName(this.memory.iram.name),
            dram: elf.readSectionByName(this.memory.dram.name),
            iflash: elf.readSectionByName(this.memory.iflash.name),
            dflash: elf.readSectionByName(this.memory.dflash.name),
        };
        this.memory.addUsage(sections.iram?.size, sections.dram?.size, sections.iflash?.size, sections.dflash?.size);

        const newSymbols = elf.readDefinedSymbols();
        newSymbols.forEach(s => this.definedSymbols.set(s.name, s));

        const resolvedEntryPoints = entryPoints.map((name, i) => {
            const symbol = this.definedSymbols.get(name);
            if (symbol) {
                return {isMain: i === entryPoints.length - 1, address: symbol.address};
            } else {
                throw new Error(`Failed to generate binary. Cannot find ${name} in executable elf.`);
            }
        });

        return {
            iram: sections.iram ? {address: sections.iram.address, data: sections.iram.value} : undefined,
            dram: sections.dram ? {address: sections.dram.address, data: sections.dram.value} : undefined,
            iflash: sections.iflash ? {address: sections.iflash.address, data: sections.iflash.value} : undefined,
            dflash: sections.dflash ? {address: sections.dflash.address, data: sections.dflash.value} : undefined,
            entryPoints: resolvedEntryPoints
        }
    }

    private getArchivesWithEspComponents(project: Project<PackageForEsp32>): string[] {
        const espArchivesFromMain = this.espIdfComponents.getArchiveFilePaths(project.mainPackage.espIdfComponents);
        const resultArchives = [project.archivePath(project.mainPackage), ...espArchivesFromMain];
        
        const visitedEspArchives = new Set(espArchivesFromMain);
        
        const addEspArchive = (espArchive: string) => {
            if (!visitedEspArchives.has(espArchive)) {
                resultArchives.push(espArchive);
                visitedEspArchives.add(espArchive);
            }
        };

        const reversedPackages = project.dependencies.filter(dep => dep.used).reverse();
        for (const pkg of reversedPackages) {
            resultArchives.push(project.archivePath(pkg));
            const espArchivesFromPkg = this.espIdfComponents.getArchiveFilePaths(pkg.espIdfComponents);
            espArchivesFromPkg.forEach(ar => addEspArchive(ar));
        }

        // Add common components
        this.espIdfComponents.commonArchiveFiles.forEach(ar => addEspArchive(ar));
        
        return resultArchives;
    }
}

class EspIdfComponents {
    public readonly commonIncludeDirs: string[];
    public readonly commonArchiveFiles: string[];
    public readonly ldFiles: string[];

    private readonly commonComponents = ["cxx", "newlib", "freertos", "esp_hw_support", "heap", "log", "soc", "hal", "esp_rom", "esp_common", "esp_system", "xtensa"];
    private readonly sdkConfigDir: string;

    private dependenciesInfo: {
        [key: string]: {
            file: string,
            dir: string,
            reqs: string[], 
            priv_reqs: string[],
            include_dirs: string[]
    }};

    constructor(runtimeDir: string, espDir: string) {
        this.sdkConfigDir = path.join(runtimeDir, 'ports/esp32/build/config');
        const dependenciesFile = path.join(runtimeDir, 'ports/esp32/build/project_description.json');
        this.dependenciesInfo = JSON.parse(fs.readFileSync(dependenciesFile).toString()).build_component_info;
        this.commonIncludeDirs = this.getIncludeDirs(this.commonComponents);
        this.commonArchiveFiles = this.getArchiveFilePaths(this.commonComponents);
        this.ldFiles = this.getLdFiles(espDir);
    }

    public getIncludeDirs(rootComponentNames: string[]) {
        const components = this.getComponents(rootComponentNames);
        const includeDirs:string[] = [];
        for (const component of components) {
            for (const dir of component.include_dirs) {
                includeDirs.push(path.join(component.dir, dir));
            }
        }
        includeDirs.push(this.sdkConfigDir);
        return includeDirs;
    }

    private getLdFiles(espDir: string) {
        // These paths are extracted from logs of `idf.py build` command.
        // Should be improved.
        return [
            path.join(espDir, `esp-idf/components/esp_rom/esp32/ld/esp32.rom.ld`),
            path.join(espDir, `esp-idf/components/esp_rom/esp32/ld/esp32.rom.api.ld`),
            path.join(espDir, `esp-idf/components/esp_rom/esp32/ld/esp32.rom.libgcc.ld`),
            path.join(espDir, `esp-idf/components/esp_rom/esp32/ld/esp32.rom.newlib-data.ld`),
            path.join(espDir, `esp-idf/components/esp_rom/esp32/ld/esp32.rom.syscalls.ld`),
            path.join(espDir, `esp-idf/components/esp_rom/esp32/ld/esp32.rom.newlib-funcs.ld`),
            path.join(espDir, `esp-idf/components/soc/esp32/ld/esp32.peripherals.ld`),
        ]
    }

    public getArchiveFilePaths(rootComponentNames: string[]) {
        return this.getComponents(rootComponentNames).map(c => c.file);
    }

    private getComponents(rootComponentNames: string[]) {
        let tmp = [...rootComponentNames];
        let visited = new Set<string>();
        const components = [];
        while(tmp.length > 0) {
            let curr = tmp.shift() as string;
            visited.add(curr);
            if (this.dependenciesInfo[curr] === undefined) {
                throw new Error(`${curr} does not exists in ESP-IDF components.`);
            }
            tmp = tmp.concat(
                this.dependenciesInfo[curr].priv_reqs.filter((r:string) => !visited.has(r)),
                this.dependenciesInfo[curr].reqs.filter((r:string) => !visited.has(r))
            );
            if (this.dependenciesInfo[curr].file !== undefined && this.dependenciesInfo[curr].file !== '')
                components.push(this.dependenciesInfo[curr]);
        }
        return components;
    }
}