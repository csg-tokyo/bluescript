import * as path from "path";
import * as fs from "fs";
import { BoardToolchain, SharedLibrary } from "./board-toolchain";
import { Project } from "../project";
import { Package, PackageForHostUnix, PackageForHostWindows } from "../package";
import { generateMakefile, hostUnixMakefilePrest, hostWindowsMakefilePreset } from "./tools/makefile";
import { executeCommand, getErrorMessage } from "../utils";

export type HostToolchainConfig = {
    runtimeDir: string,
    compilerToolchain: {
        gcc: string,
        ar: string,
        make: string
    },
}

export abstract class HostToolchain<P extends Package> implements BoardToolchain<P, SharedLibrary> {
    protected config: HostToolchainConfig;
    protected compileId: number = 0;
    protected compiledPackages = new Set<string>();
    protected generatedSharedLibs: string[] = [];

    constructor(config: HostToolchainConfig) {
        this.config = config;
    }

    get cProlog() {
        return `
#include <stdint.h>
#include "${this.cRuntimeH}"
`;
    }
    get cRuntimeH() { return path.join(this.config.runtimeDir, 'core/include/c-runtime.h'); }
    get builtinModulePath() { return path.join(this.config.runtimeDir, 'ports/host/std-module.bs'); }
    get runtimeBuildDir() { return path.join(this.config.runtimeDir, 'ports/host/build'); }

    async compileAndLink(project: Project<P>, entryPoints: string[]): Promise<SharedLibrary> {
        const archiveFiles: string[] = [];
        for (const pkg of project.usedDependencies) {
            archiveFiles.push(await this.compilePackage(pkg));
            this.compiledPackages.add(pkg.name);
        }
        archiveFiles.push(await this.compilePackage(project.mainPackage));
        const sharedLib = await this.link(project, archiveFiles, entryPoints);
        this.generatedSharedLibs.push(sharedLib);
        return {
            filePath: sharedLib,
            entryNames: entryPoints.map(name => ({isMain: name === project.mainPackage.name, name})),
        }
    }

    async additionalCompileAndLink(project: Project<P>, entryPoints: string[]): Promise<SharedLibrary> {
        const archiveFiles: string[] = [];
        for (const pkg of project.usedDependencies) {
            if (!this.compiledPackages.has(pkg.name)) {
                archiveFiles.push(await this.compilePackage(pkg));
                this.compiledPackages.add(pkg.name);
            }
        }
        archiveFiles.push(await this.compilePackage(project.mainPackage));
        const sharedLib = await this.link(project, archiveFiles, entryPoints);
        this.generatedSharedLibs.push(sharedLib);
        return {
            filePath: sharedLib,
            entryNames: entryPoints.map(name => ({isMain: name === project.mainPackage.name, name})),
        }
    }

    abstract compilePackage(pkg: P): Promise<string>;
    abstract link(project: Project<P>, archiveFiles: string[], entryPoints: string[]): Promise<string>;
}

export class HostUnixToolchain extends HostToolchain<PackageForHostUnix> {
    get runtimeSo() { return path.join(this.runtimeBuildDir, 'c-runtime.so'); }

    async compilePackage(pkg: PackageForHostUnix): Promise<string> {
        try {
            const archiveFile = pkg.archiveFile;

            // Remove old archive file.
            if (fs.existsSync(archiveFile)) {
                fs.rmSync(archiveFile, { force: true });
            }

            pkg.copyNativeFilesToDist();
            const makefile = generateMakefile(hostUnixMakefilePrest(pkg, this.config.compilerToolchain));
            pkg.writeMakefile(makefile);
            await executeCommand(this.config.compilerToolchain.make, [], pkg.resolvedDistDir);
            return archiveFile;
        } catch (error) {
            throw new Error(`Failed to compile package ${pkg.name}: ${getErrorMessage(error)}`, {cause: error});
        }
    }

    async link(project: Project<PackageForHostUnix>, archiveFiles: string[], entryPoints: string[]): Promise<string> {
        try {
            const keepEntrySymbols = entryPoints.map(
                (sym) => `-Wl,-u,_${sym}`,
            );
            const outputFile = project.mainPackage.soFile(this.compileId++);
            const args = [
                '-shared', '-fPIC', 
                '-o', outputFile, 
                ...archiveFiles, 
                ...this.generatedSharedLibs, 
                this.runtimeSo, 
                '-lm', '-ldl',
                ...keepEntrySymbols,
            ];
            await executeCommand(this.config.compilerToolchain.gcc, args);
            return outputFile;
        } catch (error) {
            throw new Error(`Failed to link: ${getErrorMessage(error)}`, {cause: error});
        }
    }
}

export class HostWindowsToolchain extends HostToolchain<PackageForHostWindows> {
    get runtimeDll(): string {
        return path.join(this.runtimeBuildDir, 'c-runtime.dll');
    }
    
    async compilePackage(pkg: PackageForHostWindows): Promise<string> {
        try {
            const archiveFile = pkg.archiveFile;
            if (fs.existsSync(archiveFile)) {
                fs.rmSync(archiveFile, { force: true });
            }
            pkg.copyNativeFilesToDist();
            const makefile = generateMakefile(
                hostWindowsMakefilePreset(pkg, this.config.compilerToolchain),
            );
            pkg.writeMakefile(makefile);
            
            await executeCommand(this.config.compilerToolchain.make, [], pkg.resolvedDistDir);
            return archiveFile;
        } catch (error) {
            throw new Error(
                `Failed to compile package ${pkg.name}: ${getErrorMessage(error)}`,
                { cause: error },
            );
        }
    }

    async link(
        project: Project<PackageForHostWindows>,
        archiveFiles: string[],
        entryPoints: string[],
    ): Promise<string> {
        try {
            const keepEntrySymbols = entryPoints.map(
                (sym) => `-Wl,-u,${sym}`,
            );
            const outputFile = project.mainPackage.dllFile(this.compileId++);
            const args = [
                '-shared',
                '-o', outputFile,
                ...archiveFiles,
                ...this.generatedSharedLibs,
                this.runtimeDll,
                '-lm',
                ...keepEntrySymbols,
                '-Wl,--export-all-symbols',
                '-Wl,--enable-auto-import',
                '-Wl,--enable-runtime-pseudo-reloc'
            ];
            await executeCommand(this.config.compilerToolchain.gcc, args);
            return outputFile;
        } catch (error) {
            throw new Error(`Failed to link: ${getErrorMessage(error)}`, { cause: error });
        }
    }
}