import { GlobalVariableNameTable } from "../transpiler/code-generator/variables";
import { transpile } from "../transpiler/code-generator/code-generator";
import * as fs from "fs";
import * as path from "path";
import {Buffer} from "node:buffer";
import { spawn } from "child_process";
import generateLinkerScript from "./linker-script";
import generateMakefile from "./makefile";
import { ElfReader } from "./elf-reader";


export type PackageConfig = {
    name: string,
    espIdfComponents: string[],
    dependencies: string[],
    dirs: {
        root: string,
        dist: string,
        build: string,
        packages: string,
    }
}

export type CompilerConfig = {
    dirs: {
        runtime: string,
        compilerToolchain: string,
        std: string
    }
};

export type MemoryLayout = {
    iram:{address:number, size:number},
    dram:{address:number, size:number},
    iflash:{address:number, size:number},
    dflash:{address:number, size:number},
}


type MemoryRegion = {name: string, address: number, size: number}

export class ShadowMemory {
    public iram: MemoryRegion;
    public dram: MemoryRegion;
    public iflash: MemoryRegion;
    public dflash: MemoryRegion;

    constructor(memoryLayout: MemoryLayout) {
        this.iram = {name: '.iram', ...memoryLayout.iram};
        this.dram = {name: '.dram', ...memoryLayout.dram};
        this.iflash = {name: '.iflash', ...memoryLayout.iflash};
        this.dflash = {name: '.dflash', ...memoryLayout.dflash};
    }
}

export type ExecutableBinary = {
    iram?: {address: number, data: Buffer},
    dram?: {address: number, data: Buffer},
    iflash?: {address: number, data: Buffer},
    dflash?: {address: number, data: Buffer},
    entryPoints: {id: number, address: number}[]
}

const MODULE_PATH = (pkg: PackageConfig, relativePath: string) => path.normalize(path.join(pkg.dirs.root, `${relativePath}.bs`));
const MODULE_C_PATH = (dir: string, moduleName: string) => path.join(dir, `bs_${moduleName}.c`);
const ARCHIVE_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.build, `lib${pkg.name}.a`);
const MAKEFILE_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.dist, 'Makefile');
const LINKER_SCRIPT = (pkg: PackageConfig) => path.join(pkg.dirs.build, "linkerscript.ld");
const LINKED_ELF_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.build, `${pkg.name}.elf`);
const STD_MODULE_PATH = (compilerConfig: CompilerConfig) => path.join(compilerConfig.dirs.std, 'index.bs');
const LD_PATH = (compilerConfig: CompilerConfig) => path.join(compilerConfig.dirs.compilerToolchain, 'xtensa-esp32-elf-ld');
const RUNTIME_ELF_PATH = (compilerConfig: CompilerConfig) => path.join(compilerConfig.dirs.runtime, 'ports/esp32/build/bluescript.elf');
const C_PROLOG = (compilerConfig: CompilerConfig) => `
#include <stdint.h>
#include "${path.join(compilerConfig.dirs.runtime, '/core/include/c-runtime.h')}"

`

export class Compiler {
    private config: CompilerConfig;
    private espidfComponents: ESPIDFComponents;
    private memory: ShadowMemory;
    private packageReader: (name: string) => PackageConfig;
    private logger: {
            info: (message: string) => void,
            error: (message: string) => void
    };

    constructor(
        memoryLayout: MemoryLayout, 
        config: CompilerConfig, 
        packageReader: (name: string) => PackageConfig,
        logger: {
            info: (message: string) => void,
            error: (message: string) => void
        }
    ) {
        this.config = config;
        this.espidfComponents = new ESPIDFComponents(config.dirs.runtime);
        this.memory = new ShadowMemory(memoryLayout);
        this.packageReader = packageReader;
        this.logger = logger;
    }

    public async compile(): Promise<ExecutableBinary> {
        const {mainPackage, subPackages, mainEntryPoint, subModuleEntryPoints} = this._transpile();
        await this._compile(mainPackage, subPackages);
        await this._link(mainPackage, subPackages, mainEntryPoint);
        return this._generateExecutableBinary(mainPackage, mainEntryPoint, subModuleEntryPoints);
    }

    private _transpile() {
        let compileId = 0;
        const stdSrc = fs.readFileSync(STD_MODULE_PATH(this.config), 'utf-8');
        const nameTable = transpile(++compileId, stdSrc, undefined).names;
        const modules = new Map<string, GlobalVariableNameTable>(); // <path, nameTable>
        const subModuleEntryPoints: string[] = [];

        const mp = this.packageReader('main');
        const mainPackage: PackageConfig = mp;
        const visitedPackages: PackageConfig[] = [];
        let currentPackage: PackageConfig = mainPackage;

        const importer = (fname: string) => {
            let relativePath: string;
            if (!fname.startsWith('.')) {
                let pkg = visitedPackages.find(p => p.name === fname)
                if (!pkg) { // not visited package
                    currentPackage = this.packageReader(fname);
                    visitedPackages.push(currentPackage);
                }
                relativePath = './index';
            } else {
                relativePath = fname;
            }

            const modulePath = MODULE_PATH(currentPackage, relativePath);
            const mod = modules.get(modulePath);
            if (mod)
                return mod;
            else {
                if (!fs.existsSync(modulePath)) {
                    throw new Error(`Cannot find ${modulePath}`);
                }
                // Transpile
                const src = fs.readFileSync(modulePath).toString();
                const id = ++compileId;
                const result = transpile(id, src, nameTable, importer, id);
                modules.set(modulePath, result.names);
                subModuleEntryPoints.push(result.main);
                // Save C code
                const cSaveDir = path.join(currentPackage.dirs.dist, path.parse(relativePath).root);
                fs.mkdirSync(cSaveDir, {recursive: true});
                fs.writeFileSync(MODULE_C_PATH(cSaveDir, path.parse(relativePath).name), C_PROLOG(this.config) + result.code);
                return result.names;
            }
        }
    
        try {
            this.logger.info('Transpiling...');
            fs.mkdirSync(mainPackage.dirs.dist, {recursive: true});
            const mainSrc = fs.readFileSync(MODULE_PATH(mainPackage, './index'), 'utf-8');
            const result = transpile(++compileId, mainSrc, nameTable, importer);
            fs.writeFileSync(MODULE_C_PATH(mainPackage.dirs.dist, 'index'), C_PROLOG(this.config) + result.code);
            return {mainPackage, subPackages: visitedPackages, mainEntryPoint: result.main, subModuleEntryPoints};
        } catch (error) {
            this.logger.error(`Failed to transpile: ${error}`);
            throw error;
        }  
    }

    private async _compile(mainPackage: PackageConfig, subPackages: PackageConfig[]) {
        this.logger.info('Compiling with GCC...');

        // Compile each package with make.
        const commonIncludeDirs = this.espidfComponents.commonIncludeDirs;
        for (const pkg of [mainPackage, ...subPackages]) {
            try {
                this.logger.info(`Compiling ${pkg.name}...`);
                const makefile = generateMakefile(
                    this.config.dirs.compilerToolchain,
                    pkg,
                    [...this.espidfComponents.getIncludeDirs(pkg.dependencies), ...commonIncludeDirs],
                    ARCHIVE_PATH(pkg)
                );
                fs.writeFileSync(MAKEFILE_PATH(pkg), makefile);
                await executeCommand('make', pkg.dirs.dist, false);
            } catch (error) {
                this.logger.error(`Failed to compile ${pkg.name}: ${error}`);
                throw error;
            }
        }
    }

    private async _link(mainPackage: PackageConfig, subPackages: PackageConfig[], mainEntryPoint: string) {
        this.logger.info(`Linking...`);
        try {
            const cwd = process.cwd();
            const elfReader = new ElfReader(RUNTIME_ELF_PATH(this.config));
            const symbolsInRuntime = elfReader.readAllSymbols().map(symbol => ({name: symbol.name, address: symbol.address}));
            const linkerscript = generateLinkerScript(
                [path.relative(cwd, ARCHIVE_PATH(mainPackage)), ...subPackages.map(pkg=>path.relative(cwd, ARCHIVE_PATH(pkg)))],
                this._getArchivesWithEspComponents(mainPackage, subPackages).map(ar => path.relative(cwd, ar)),
                this.memory,
                symbolsInRuntime,
                mainEntryPoint
            );
            fs.writeFileSync(LINKER_SCRIPT(mainPackage), linkerscript);
            await executeCommand(`${LD_PATH(this.config)} -o ${LINKED_ELF_PATH(mainPackage)} -T ${LINKER_SCRIPT(mainPackage)} --gc-sections`, cwd);
        } catch (error) {
            this.logger.error(`Failed to link: ${error}`);
            throw error;
        }
    }

    private _getArchivesWithEspComponents(mainPackage: PackageConfig, subPackages: PackageConfig[]): string[] {
        const espArchivesFromMain = this.espidfComponents.getArchiveFilePaths(mainPackage.espIdfComponents);
        const resultArchives = [ARCHIVE_PATH(mainPackage), ...espArchivesFromMain];
        const visitedEspArchives = new Set(espArchivesFromMain);
        const reversedPackages = subPackages.reverse();
        const addEspArchive = (espArchive: string) => {
            if (!visitedEspArchives.has(espArchive)) {
                resultArchives.push(espArchive);
                visitedEspArchives.add(espArchive);
            }
        }
        for (const pkg of reversedPackages) {
            resultArchives.push(ARCHIVE_PATH(pkg));
            const espArchivesFromPkg = this.espidfComponents.getArchiveFilePaths(pkg.espIdfComponents);
            espArchivesFromPkg.forEach(ar => addEspArchive(ar));
        }
        this.espidfComponents.commonArchiveFilePaths.forEach(ar => addEspArchive(ar));
        return resultArchives;
    }

    private _generateExecutableBinary(
        mainPackage: PackageConfig, mainEntryPointName: string, subEntryPointNames: string[]
    ): ExecutableBinary {
        const linkedElf = new ElfReader(LINKED_ELF_PATH(mainPackage));
        const definedSymbols = linkedElf.readDefinedSymbols();
        const iramSection = linkedElf.readSectionByName(this.memory.iram.name);
        const dramSection = linkedElf.readSectionByName(this.memory.dram.name);
        const iflashSection = linkedElf.readSectionByName(this.memory.iflash.name);
        const dflashSection = linkedElf.readSectionByName(this.memory.dflash.name);
        const entryPoints: {id: number, address: number}[] = [];
        const setEntryPoint = (id: number, name: string) => {
            const symbol = definedSymbols.find(s => s.name === name);
            if (symbol) { entryPoints.push({id, address: symbol.address}); }
            else { throw new Error(`Cannot find ${name} in executable elf.`) }
        }
        subEntryPointNames.forEach(epn => setEntryPoint(-1, epn));
        setEntryPoint(0, mainEntryPointName);
        return {
            iram: iramSection ? {address: iramSection.address, data: iramSection.value} : undefined,
            dram: dramSection ? {address: dramSection.address, data: dramSection.value} : undefined,
            iflash: iflashSection ? {address: iflashSection.address, data: iflashSection.value} : undefined,
            dflash: dflashSection ? {address: dflashSection.address, data: dflashSection.value} : undefined,
            entryPoints
        }
    }
}


class ESPIDFComponents {
    public readonly commonIncludeDirs: string[];
    public readonly commonArchiveFilePaths: string[];

    private readonly COMPONENTS_PATH_PREFIX = /^.*microcontroller/;
    private readonly COMMON_COMPONENTS = ["cxx", "newlib", "freertos", "esp_hw_support", "heap", "log", "soc", "hal", "esp_rom", "esp_common", "esp_system"];
    private readonly RUNTIME_DIR: string; 
    private readonly SDK_CONFIG_DIR: string;

    private dependenciesInfo: {
        [key: string]: {
            file: string,
            dir: string,
            reqs: string[], 
            priv_reqs: string[],
            include_dirs: string[]
    }};

    constructor(runtimeDir: string) {
        this.RUNTIME_DIR = runtimeDir;
        this.SDK_CONFIG_DIR = path.join(runtimeDir, 'ports/esp32/build/config');
        const dependenciesFile = path.join(runtimeDir, 'ports/esp32/build/project_description.json');
        this.dependenciesInfo = JSON.parse(fs.readFileSync(dependenciesFile).toString()).build_component_info;
        this.commonIncludeDirs = this.getIncludeDirs(this.COMMON_COMPONENTS);
        this.commonArchiveFilePaths = this.getArchiveFilePaths(this.COMMON_COMPONENTS);
    }

    public getIncludeDirs(rootComponentNames: string[]) {
        const components = this._getComponents(rootComponentNames);
        const includeDirs:string[] = [];
        for (const component of components) {
            for (const dir of component.include_dirs) {
                includeDirs.push(path.join(component.dir, dir));
            }
        }
        includeDirs.push(this.SDK_CONFIG_DIR);
        return includeDirs;
    }

    public getArchiveFilePaths(rootComponentNames: string[]) {
        return this._getComponents(rootComponentNames).map(c => c.file);
    }

    private _getComponents(rootComponentNames: string[]) {
        let tmp = [...rootComponentNames];
        let visited = new Set<string>();
        const components = [];
        while(tmp.length > 0) {
        let curr = tmp.shift() as string;
        visited.add(curr)
        tmp = tmp.concat(
            this.dependenciesInfo[curr].priv_reqs.filter((r:string) => !visited.has(r)),
            this.dependenciesInfo[curr].reqs.filter((r:string) => !visited.has(r))
        );
        if (this.dependenciesInfo[curr].file !== undefined && this.dependenciesInfo[curr].file !== '')
            components.push(this.dependenciesInfo[curr]);
        }
        return components;
    }

    private _convertRuntimeDirPath(absolutePath: string) {
        return absolutePath.replace(this.COMPONENTS_PATH_PREFIX, this.RUNTIME_DIR);
    }
}


function executeCommand(command: string, cwd?: string, showStdout:boolean=true): Promise<void> {
  return new Promise((resolve, reject) => {
    const executeProcess = spawn(command, {shell: true, cwd});

    executeProcess.stdout.on('data', (data) => {
        if (showStdout) {
            process.stdout.write(data.toString());
        }
    });

    executeProcess.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
    });

    executeProcess.on('error', (err) => {
        reject(new Error(`Failed to execute ${command}: ${err.message}`));
    });

    executeProcess.on('close', (code) => {
        if (code === 0) {
            resolve();
        } else {
            reject(new Error(`Failed to execute ${command}. Code: ${code}`));
        }
    });
  });
}



