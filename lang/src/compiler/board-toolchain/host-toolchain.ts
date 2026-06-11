import * as path from "path";
import * as fs from "fs";
import { BoardToolchain, SharedObjects } from "./board-toolchain";
import { Package, ProjectForHost } from "../project";
import { generateMakefile2, hostMakefilePreset } from "./makefile2";
import { executeCommand, getErrorMessage } from "../utils";


export class HostToolchain implements BoardToolchain<ProjectForHost, SharedObjects> {
    private runtimeDir: string;

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

    async compileAndLink(project: ProjectForHost, entryPoints: string[]): Promise<SharedObjects> {
        const soFiles: string[] = [ this.runtimeSo ];
        const packages = project.usedDependencies.reverse();
        for (const pkg of packages) {
            soFiles.push(await this.compilePackage(project, pkg, soFiles));
        }
        soFiles.push(await this.compilePackage(project, project.mainPackage, soFiles));
        return {
            soFiles: soFiles,
            entryNames: entryPoints.map((v, i) => ({isMain: i === entryPoints.length - 1, name: v})),
        };
    }

    async additionalCompileAndLink(project: ProjectForHost, entryPoints: string[]): Promise<SharedObjects> {
        return {
            soFiles: [],
            entryNames: [],
        };
    }

    private async compilePackage(project: ProjectForHost, pkg: Package, existingSoFiles: string[]): Promise<string> {
        try {
            const soFile = project.packageSoFile(pkg);
            const includeDirs: string[] = [];

            // Remove old so file.
            if (fs.existsSync(soFile)) {
                fs.rmSync(soFile, { force: true });
            }

            const makefile = generateMakefile2(hostMakefilePreset(
                pkg, includeDirs, soFile, existingSoFiles
            ));
            project.writeMakefile(pkg, makefile);
            await executeCommand('make', [], pkg.resolvedDistDir);
            return soFile;
        } catch (error) {
            throw new Error(`Failed to compile package ${pkg.name}: ${getErrorMessage(error)}`, {cause: error});
        }
    }
}