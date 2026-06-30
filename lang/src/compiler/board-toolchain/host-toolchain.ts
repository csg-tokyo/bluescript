import * as path from "path";
import * as fs from "fs";
import { BoardToolchain, SharedLibrary } from "./board-toolchain";
import { Project } from "../project";
import { Package, PackageForHostUnix } from "../package";
import { generateMakefile, hostUnixMakefilePrest } from "./tools/makefile2";
import { executeCommand, getErrorMessage } from "../utils";


export abstract class HostToolchain<P extends Package> implements BoardToolchain<P, SharedLibrary> {
    protected runtimeDir: string;
    protected compileId: number = 0;
    protected compiledPackages = new Set<string>();
    protected generatedSharedLibs: string[] = [];

    constructor(runtimeDir: string) {
        this.runtimeDir = runtimeDir;
    }

    get cProlog() {
        return `
#include <stdint.h>
#include "${this.cRuntimeH}"
`;
    }
    get cRuntimeH() { return path.join(this.runtimeDir, 'core/include/c-runtime.h'); }
    get builtinModulePath() { return path.join(this.runtimeDir, 'ports/host/std-module.bs'); }
    get runtimeBuildDir() { return path.join(this.runtimeDir, 'ports/host/build'); }
    get executableShell() { return path.join(this.runtimeBuildDir, 'shell'); }
    get runtimeSo() { return path.join(this.runtimeBuildDir, 'c-runtime.so'); }

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
    async compilePackage(pkg: PackageForHostUnix): Promise<string> {
        try {
            const archiveFile = pkg.archiveFile;

            // Remove old archive file.
            if (fs.existsSync(archiveFile)) {
                fs.rmSync(archiveFile, { force: true });
            }

            pkg.copyNativeFilesToDist();
            const makefile = generateMakefile(hostUnixMakefilePrest(pkg));
            pkg.writeMakefile(makefile);
            await executeCommand('make', [], pkg.resolvedDistDir);
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
            await executeCommand('cc', args);
            return outputFile;
        } catch (error) {
            throw new Error(`Failed to link: ${getErrorMessage(error)}`, {cause: error});
        }
    }
}