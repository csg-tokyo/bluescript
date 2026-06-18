import * as path from "path";
import * as fs from "fs";
import { BoardToolchain, SharedObject } from "./board-toolchain";
import { Package, ProjectForHost } from "../project";
import { generateMakefile, hostMakefilePreset } from "./tools/makefile";
import { executeCommand, getErrorMessage } from "../utils";


export class HostToolchain implements BoardToolchain<ProjectForHost, SharedObject> {
    private runtimeDir: string;
    private compileId: number = 0;
    private compiledPackages = new Set<string>();
    private generatedSoFiles: string[] = [];

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

    async compileAndLink(project: ProjectForHost, entryPoints: string[]): Promise<SharedObject> {
        const archiveFiles: string[] = [];
        for (const pkg of project.usedDependencies) {
            archiveFiles.push(await this.compilePackage(project, pkg));
            this.compiledPackages.add(pkg.name);
        }
        archiveFiles.push(await this.compilePackage(project, project.mainPackage));
        const soFile = project.soFile();
        await this.link(archiveFiles, entryPoints, soFile);
        this.generatedSoFiles.push(soFile);
        return {
            soFile,
            entryNames: entryPoints.map(name => ({isMain: name === project.mainPackage.name, name})),
        }
    }

    async additionalCompileAndLink(project: ProjectForHost, entryPoints: string[]): Promise<SharedObject> {
        const archiveFiles: string[] = [];
        for (const pkg of project.usedDependencies) {
            if (!this.compiledPackages.has(pkg.name)) {
                archiveFiles.push(await this.compilePackage(project, pkg));
                this.compiledPackages.add(pkg.name);
            }
        }
        archiveFiles.push(await this.compilePackage(project, project.mainPackage));
        const soFile = project.soFile(this.compileId++);
        await this.link(archiveFiles, entryPoints, soFile);
        this.generatedSoFiles.push(soFile);
        return {
            soFile,
            entryNames: entryPoints.map(name => ({isMain: name === project.mainPackage.name, name})),
        }
    }

    private async compilePackage(project: ProjectForHost, pkg: Package): Promise<string> {
        try {
            const archiveFile = project.archiveFile(pkg);

            // Remove old archive file.
            if (fs.existsSync(archiveFile)) {
                fs.rmSync(archiveFile, { force: true });
            }

            const makefile = generateMakefile(hostMakefilePreset(pkg, archiveFile));
            project.writeMakefile(pkg, makefile);
            await executeCommand('make', [], pkg.resolvedDistDir);
            return archiveFile;
        } catch (error) {
            throw new Error(`Failed to compile package ${pkg.name}: ${getErrorMessage(error)}`, {cause: error});
        }
    }

    private linkerSymbolName(sym: string): string {
        return process.platform === 'darwin' ? `_${sym}` : sym;
    }

    private async link(archiveFiles: string[], entryPoints: string[], outputFile: string): Promise<void> {
        try {
            const keepEntrySymbols = entryPoints.map(
                (sym) => `-Wl,-u,${this.linkerSymbolName(sym)}`,
            );
            const args = [
                '-shared', '-fPIC', 
                '-o', outputFile, 
                ...archiveFiles, 
                ...this.generatedSoFiles, 
                this.runtimeSo, 
                '-lm', '-ldl',
                ...keepEntrySymbols,
            ];
            await executeCommand('cc', args);
        } catch (error) {
            throw new Error(`Failed to link: ${getErrorMessage(error)}`, {cause: error});
        }
    }
}