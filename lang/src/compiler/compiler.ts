import { GlobalVariableNameTable } from "../transpiler/code-generator/variables";
import { transpile } from "../transpiler/code-generator/code-generator";
import * as fs from "fs";
import * as path from "path";
import {Buffer} from "node:buffer";
import { spawn } from "child_process";
import generateLinkerScript from "./linker-script";
import generateMakefile from "./makefile";
import { ElfReader, Section, Symbol } from "./elf-reader";


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
    runtimeDir: string,
    compilerToolchainDir: string,
};

export type MemoryLayout = {
    iram:{address:number, size:number},
    dram:{address:number, size:number},
    iflash:{address:number, size:number},
    dflash:{address:number, size:number},
}


type MemoryRegion = {name: string, address: number, size: number, used: number}

export class ShadowMemory {
    public iram: MemoryRegion;
    public dram: MemoryRegion;
    public iflash: MemoryRegion;
    public dflash: MemoryRegion;

    constructor(memoryLayout: MemoryLayout) {
        this.iram = {name: '.iram', ...memoryLayout.iram, used: 0};
        this.dram = {name: '.dram', ...memoryLayout.dram, used: 0};
        this.iflash = {name: '.iflash', ...memoryLayout.iflash, used: 0};
        this.dflash = {name: '.dflash', ...memoryLayout.dflash, used: 0};
    }
}

export type ExecutableBinary = {
    iram?: {address: number, data: Buffer},
    dram?: {address: number, data: Buffer},
    iflash?: {address: number, data: Buffer},
    dflash?: {address: number, data: Buffer},
    entryPoints: {isMain: boolean, address: number}[]
}


const MODULE_C_PATH = (dir: string, name: string) => path.join(dir, `bs_${name}.c`);
const ARCHIVE_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.build, `lib${pkg.name}.a`);
const MAKEFILE_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.dist, 'Makefile');
const LINKER_SCRIPT = (pkg: PackageConfig) => path.join(pkg.dirs.build, "linkerscript.ld");
const LINKED_ELF_PATH = (pkg: PackageConfig) => path.join(pkg.dirs.build, `${pkg.name}.elf`);
const LD_PATH = (compilerConfig: CompilerConfig) => path.join(compilerConfig.compilerToolchainDir, 'xtensa-esp32-elf-ld');
const RUNTIME_ELF_PATH = (compilerConfig: CompilerConfig) => path.join(compilerConfig.runtimeDir, 'ports/esp32/build/bluescript.elf');
const STD_MODULE_PATH = (compilerConfig: CompilerConfig) => path.join(compilerConfig.runtimeDir, 'ports/esp32/std-module.bs');
const C_PROLOG = (compilerConfig: CompilerConfig) => `
#include <stdint.h>
#include "${path.join(compilerConfig.runtimeDir, '/core/include/c-runtime.h')}"

`

export class Compiler {
    private config: CompilerConfig;
    private espidfComponents: ESPIDFComponents;
    private memory: ShadowMemory;
    private definedSymbols: Map<string, Symbol>; // {name, address}
    private transpiler: TranspilerWithPkgSystem;
    private packageReader: (name: string) => PackageConfig;
    
    constructor(
        memoryLayout: MemoryLayout, 
        config: CompilerConfig, 
        packageReader: (name: string) => PackageConfig,
    ) {
        this.config = config;
        this.espidfComponents = new ESPIDFComponents(config.runtimeDir);
        this.memory = new ShadowMemory(memoryLayout);
        this.packageReader = packageReader;
        const elfReader = new ElfReader(RUNTIME_ELF_PATH(this.config));
        this.definedSymbols = new Map(elfReader.readAllSymbols().map(s => [s.name, s]));
        this.transpiler = new TranspilerWithPkgSystem(this.packageReader, STD_MODULE_PATH(config), C_PROLOG(config));
        this.clean();
        this.checkFileNamesInMain();
    }

    private clean() {
        const mainPackage = this.packageReader('main');
        this.cleanDistDir(mainPackage);
        this.getDependencies(mainPackage).forEach(d => this.cleanDistDir(d));
    }

    private cleanDistDir(pkg: PackageConfig) {
        if (fs.existsSync(pkg.dirs.dist)) {
            fs.rmSync(pkg.dirs.dist, {recursive: true});
        }
    }

    private getDependencies(mainPackage: PackageConfig) {
        const tmp = mainPackage.dependencies.map(pname => this.packageReader(pname));
        const visited = new Set<PackageConfig>();
        while(tmp.length > 0) {
            const curr = tmp.pop() as PackageConfig;
            visited.add(curr);
            curr.dependencies.forEach(d => {
                const pkg = this.packageReader(d);
                if (!visited.has(pkg)) {
                    tmp.push(pkg);
                }
            });
        }
        return Array.from(visited);
    }

    private checkFileNamesInMain() {
        const mainPackage = this.packageReader('main');
        const invalidFilePattern = /^\d+\.bs$/; // This pattern can be used to save interactively added program.
        const files = fs.readdirSync(mainPackage.dirs.root);
        for (const file of files) {
            if (invalidFilePattern.test(file)) {
                const fullPath = path.join(mainPackage.dirs.root, file);
                throw new Error(`Invalid file name: ${fullPath}\nBlueScript source file names cannot consist solely of digits.`);
            }
        }
    }

    public async compile(src?: string): Promise<ExecutableBinary> {
        const {mainPackage, subPackages, mainEntryPoint, subModuleEntryPoints} = this.transpiler.transpile(src);
        await this.compileC(mainPackage, subPackages);
        await this.link(mainPackage, subPackages, mainEntryPoint, subModuleEntryPoints);
        return this.generateExecutableBinary(mainPackage, mainEntryPoint, subModuleEntryPoints);
    }

    private async compileC(mainPackage: PackageConfig, subPackages: PackageConfig[]) {
        await this.compilePackage(mainPackage);
        for (const pkg of subPackages) {
            await this.compilePackage(pkg);
        }
    }

    private async compilePackage(pkg: PackageConfig) {
        const commonIncludeDirs = this.espidfComponents.commonIncludeDirs;
        try {
            fs.rmSync(ARCHIVE_PATH(pkg), {force: true});
            const makefile = generateMakefile(
                this.config.compilerToolchainDir,
                pkg,
                [...this.espidfComponents.getIncludeDirs(pkg.espIdfComponents), ...commonIncludeDirs],
                ARCHIVE_PATH(pkg)
            );
            fs.writeFileSync(MAKEFILE_PATH(pkg), makefile);
            await executeCommand('ls', pkg.dirs.dist);
            await executeCommand('make', pkg.dirs.dist);
        } catch (error) {
            throw new Error(`Failed to compile package ${pkg.name}: ${getErrorMessage(error)}`, {cause: error});
        }
    }

    private async link(mainPackage: PackageConfig, subPackages: PackageConfig[], mainEntryPoint: string, subModuleEntryPoints: string[]) {
        try {
            const cwd = process.cwd();
            const linkerscript = generateLinkerScript(
                this.getArchivesWithEspComponents(mainPackage, subPackages).map(ar => path.relative(cwd, ar)),
                this.memory,
                [...this.definedSymbols.values()],
                mainEntryPoint,
                subModuleEntryPoints
            );
            fs.writeFileSync(LINKER_SCRIPT(mainPackage), linkerscript);
            await executeCommand(`${LD_PATH(this.config)} -o ${LINKED_ELF_PATH(mainPackage)} -T ${LINKER_SCRIPT(mainPackage)} --gc-sections`, cwd);
        } catch (error) {
            throw new Error(`Failed to link: ${getErrorMessage(error)}`, {cause: error});
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
        const iramSection = linkedElf.readSectionByName(this.memory.iram.name);
        const dramSection = linkedElf.readSectionByName(this.memory.dram.name);
        const iflashSection = linkedElf.readSectionByName(this.memory.iflash.name);
        const dflashSection = linkedElf.readSectionByName(this.memory.dflash.name);
        this.updateDefinedSymbols(linkedElf);
        this.updateMemory(iramSection, dramSection, iflashSection, dflashSection);

        const entryPoints: {isMain: boolean, address: number}[] = [];
        const setEntryPoint = (isMain: boolean, name: string) => {
            const symbol = this.definedSymbols.get(name);
            if (symbol) { entryPoints.push({isMain, address: symbol.address}); }
            else { throw new Error(`Failed to generate binary. Cannot find ${name} in executable elf.`) }
        }
        subEntryPointNames.forEach(epn => setEntryPoint(false, epn));
        setEntryPoint(true, mainEntryPointName);
        return {
            iram: iramSection ? {address: iramSection.address, data: iramSection.value} : undefined,
            dram: dramSection ? {address: dramSection.address, data: dramSection.value} : undefined,
            iflash: iflashSection ? {address: iflashSection.address, data: iflashSection.value} : undefined,
            dflash: dflashSection ? {address: dflashSection.address, data: dflashSection.value} : undefined,
            entryPoints
        }
    }

    private updateDefinedSymbols(linkedElf: ElfReader) {
        const definedSymbols = linkedElf.readDefinedSymbols();
        definedSymbols.forEach(s => this.definedSymbols.set(s.name, s));
    }

    private updateMemory(iram?: Section, dram?: Section, iflash?: Section, dflash?: Section) {
        if (iram) this.memory.iram.used += iram.size;
        if (dram) this.memory.dram.used += dram.size;
        if (iflash) this.memory.iflash.used += iflash.size;
        if (dflash) this.memory.dflash.used += dflash.size;
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
    private codeId: number = 0;
    private sessionId: number = 0;
    private moduleId: number = 0;
    private modules: Map<PathInPkg, GlobalVariableNameTable>;
    private cProlog: string;

    private packageReader: (name: string) => PackageConfig;
    private visitedPkgs: PackageConfig[];


    constructor(packageReader: (name: string) => PackageConfig, stdModuleFile: string, cProlog: string) {
        const stdSrc = fs.readFileSync(stdModuleFile, 'utf-8');
        this.globalNames = transpile(this.sessionId++, stdSrc).names;
        this.modules = new Map<PathInPkg, GlobalVariableNameTable>();
        this.cProlog = cProlog;
        this.packageReader = packageReader;
        this.visitedPkgs = [];
    }

    public transpile(src?: string) {
        let pathInPkg: PathInPkg;
        if (src === undefined) {
            pathInPkg = { ext: '.bs', name: 'index', dir: './', pkg: this.packageReader('main')};
            src = this.readFile(pathInPkg);
        } else {
            pathInPkg = { ext: '.bs', name: `${this.codeId++}`, dir: './', pkg: this.packageReader('main')};
        }
        const subModuleEntryPoints: string[] = [];
        const result = transpile(this.sessionId++, src, this.globalNames, this.makeImporter(pathInPkg, subModuleEntryPoints));
        this.writeCFile(pathInPkg, result.code);
        this.globalNames = result.names;
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
                const result = transpile(this.sessionId++, src, this.globalNames, this.makeImporter(pathInPkg, entryPoints), this.moduleId++);
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
        const components = this.getComponents(rootComponentNames);
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

    private convertRuntimeDirPath(absolutePath: string) {
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

