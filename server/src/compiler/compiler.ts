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


const MODULE_C_PATH = (dir: string, name: string) => path.join(dir, `bs_${name}.c`);
const ARCHIVE_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.build, `lib${pkg.name}.a`);
const MAKEFILE_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.dist, 'Makefile');
const LINKER_SCRIPT = (pkg: PackageConfig) => path.join(pkg.dirs.build, "linkerscript.ld");
const LINKED_ELF_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.build, `${pkg.name}.elf`);
const STD_MODULE_PATH = (dir: string) => path.join(dir, 'index.bs');
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

    constructor(
        memoryLayout: MemoryLayout, 
        config: CompilerConfig, 
        packageReader: (name: string) => PackageConfig,
    ) {
        this.config = config;
        this.espidfComponents = new ESPIDFComponents(config.dirs.runtime);
        this.memory = new ShadowMemory(memoryLayout);
        this.packageReader = packageReader;
    }

    public async compile(): Promise<ExecutableBinary> {
        const {mainPackage, subPackages, mainEntryPoint, subModuleEntryPoints} = this.transpile();
        await this.compileC(mainPackage, subPackages);
        await this.link(mainPackage, subPackages, mainEntryPoint);
        return this.generateExecutableBinary(mainPackage, mainEntryPoint, subModuleEntryPoints);
    }

    private transpile() {
        try {
            const transpiler = new TranspilerWithPkgSystem(this.packageReader, this.config.dirs.std, C_PROLOG(this.config));
            return transpiler.transpile();
        } catch (error) {
            throw new Error(`Failed to transpile: ${getErrorMessage(error)}`, {cause: error});
        }
    }

    private async compileC(mainPackage: PackageConfig, subPackages: PackageConfig[]) {
        // Compile each package with make.
        const commonIncludeDirs = this.espidfComponents.commonIncludeDirs;
        for (const pkg of [mainPackage, ...subPackages]) {
            try {
                const makefile = generateMakefile(
                    this.config.dirs.compilerToolchain,
                    pkg,
                    [...this.espidfComponents.getIncludeDirs(pkg.espIdfComponents), ...commonIncludeDirs],
                    ARCHIVE_PATH(pkg)
                );
                fs.writeFileSync(MAKEFILE_PATH(pkg), makefile);
                await executeCommand('make', pkg.dirs.dist, false);
            } catch (error) {
                throw new Error(`Failed to compile package ${pkg.name}: ${getErrorMessage(error)}`, {cause: error});
            }
        }
    }

    private async link(mainPackage: PackageConfig, subPackages: PackageConfig[], mainEntryPoint: string) {
        try {
            const cwd = process.cwd();
            const elfReader = new ElfReader(RUNTIME_ELF_PATH(this.config));
            const symbolsInRuntime = elfReader.readAllSymbols().map(symbol => ({name: symbol.name, address: symbol.address}));
            const linkerscript = generateLinkerScript(
                [path.relative(cwd, ARCHIVE_PATH(mainPackage)), ...subPackages.map(pkg=>path.relative(cwd, ARCHIVE_PATH(pkg)))],
                this.getArchivesWithEspComponents(mainPackage, subPackages).map(ar => path.relative(cwd, ar)),
                this.memory,
                symbolsInRuntime,
                mainEntryPoint
            );
            fs.writeFileSync(LINKER_SCRIPT(mainPackage), linkerscript);
            await executeCommand(`${LD_PATH(this.config)} -o ${LINKED_ELF_PATH(mainPackage)} -T ${LINKER_SCRIPT(mainPackage)} --gc-sections`, cwd);
        } catch (error) {
            throw new Error(`Failed to link: ${getErrorMessage}`, {cause: error});
        }
    }

    private getArchivesWithEspComponents(mainPackage: PackageConfig, subPackages: PackageConfig[]): string[] {
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

    private generateExecutableBinary(
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
            else { throw new Error(`Failed to generate binary. Cannot find ${name} in executable elf.`) }
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


type PathInPkg = {
    ext: string,
    name: string,
    dir: string,
    pkg: PackageConfig
}

class TranspilerWithPkgSystem {
    public globalNames?: GlobalVariableNameTable;
    private sessionId: number;
    private moduleId: number;
    private modules: Map<PathInPkg, GlobalVariableNameTable>;
    private cProlog: string;

    private packageReader: (name: string) => PackageConfig;
    private visitedPkgs: PackageConfig[];


    constructor(packageReader: (name: string) => PackageConfig, stdDir: string, cProlog: string) {
        this.sessionId = 0;
        this.moduleId = 0;
        const stdSrc = fs.readFileSync(STD_MODULE_PATH(stdDir), 'utf-8');
        this.globalNames = transpile(++this.sessionId, stdSrc, undefined).names;
        this.modules = new Map<PathInPkg, GlobalVariableNameTable>();
        this.cProlog = cProlog;
        this.packageReader = packageReader;
        this.visitedPkgs = [];
    }

    public transpile() {
        const pathInPkg = { ext: '.bs', name: 'index', dir: './', pkg: this.packageReader('main')};
        const src = this.readFile(pathInPkg);
        const subModuleEntryPoints: string[] = [];
        this.sessionId += 1;
        const result = transpile(this.sessionId, src, this.globalNames, this.makeImporter(pathInPkg, subModuleEntryPoints));
        this.writeCFile(pathInPkg, result.code);
        return {mainPackage: pathInPkg.pkg, subPackages: this.visitedPkgs, mainEntryPoint: result.main, subModuleEntryPoints};
    }

    private makeImporter(pathInPkg: PathInPkg, entryPoints: string[]) {
        return (name: string): GlobalVariableNameTable => {
            pathInPkg = this.getPathInPkg(name, pathInPkg);
            if (!this.visitedPkgs.find(p => p.name === pathInPkg.pkg.name))
                this.visitedPkgs.push(pathInPkg.pkg);

            const mod = this.modules.get(pathInPkg);
            if (mod)
                return mod;
            else {
                const src = this.readFile(pathInPkg);
                this.moduleId += 1;
                this.sessionId += 1;
                const result = transpile(this.sessionId, src, this.globalNames, this.makeImporter(pathInPkg, entryPoints), this.moduleId);
                this.modules.set(pathInPkg, result.names);
                entryPoints.push(result.main);
                this.writeCFile(pathInPkg, result.code);
                return result.names;
            }
        }
    }

    private getPathInPkg(name: string, oldPathInPkg: PathInPkg): PathInPkg {
        if (path.isAbsolute(name)) {
            throw new Error("This module system does not support importing from absolute paths.");
        } else if (name.startsWith('.')) { // move in package
            const parsedName = path.parse(name);
            return { // move in package
                ext: '.bs',
                name: parsedName.name,
                dir: path.join(oldPathInPkg.dir, parsedName.dir),
                pkg: oldPathInPkg.pkg
            }
        } else { // move to new package
            const [pkgName, ...remain] = name.split(path.sep);
            const pkg = this.packageReader(pkgName);
            const fname = remain.pop();
            return { ext: '.bs', name: fname ?? 'index', dir: remain.join(path.sep), pkg};
        }
    }

    private readFile(pathInPkg: PathInPkg) {
        const filePath = path.join(pathInPkg.pkg.dirs.root, pathInPkg.dir, pathInPkg.name + pathInPkg.ext);
        try {
            return fs.readFileSync(filePath).toString('utf-8')
        }
        catch (e) {
            throw new Error(`Cannot find a module ${filePath}`)
        }
    }

    private writeCFile(pathInPkg: PathInPkg, code: string) {
        const cSaveDir = path.join(pathInPkg.pkg.dirs.dist, pathInPkg.dir);
        fs.mkdirSync(cSaveDir, {recursive: true});
        fs.writeFileSync(MODULE_C_PATH(cSaveDir, pathInPkg.name), this.cProlog + code);
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

    private _convertRuntimeDirPath(absolutePath: string) {
        return absolutePath.replace(this.COMPONENTS_PATH_PREFIX, this.RUNTIME_DIR);
    }
}


function executeCommand(command: string, cwd?: string, showStdout = false, showStderr = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const executeProcess = spawn(command, {shell: true, cwd});

    let stdout = '';
    let stderr = '';

    executeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        if (showStdout) {
            process.stdout.write(chunk);
        }
        stdout += chunk;
    });

    executeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        if (showStderr) {
            process.stderr.write(chunk);
        }
        stderr += chunk;
    });

    executeProcess.on('error', (err) => {
        reject(new Error(`Failed to execute ${command}: ${err.message}. stderr: ${stderr}`));
    });

    executeProcess.on('close', (code) => {
        if (code === 0) {
            resolve();
        } else {
            reject(new Error(`Failed to execute ${command}. Code: ${code}. stderr: ${stderr}`));
        }
    });
  });
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    else return String(error);
}

