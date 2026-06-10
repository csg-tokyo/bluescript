import { GlobalVariableNameTable } from "../transpiler/code-generator/variables";
import { transpile } from "../transpiler/code-generator/code-generator";
import * as fs from "fs";
import * as path from "path";
import { AbsolutePath, RelativePath, Package, Project } from "./project";


class PathInPkg {
    public pkg: Package;
    public relativePath: RelativePath;
    public absolutePath: AbsolutePath;

    constructor(pkg: Package, relativePath: RelativePath) {
        this.pkg = pkg;
        this.checkRelativePath(relativePath);
        this.relativePath = relativePath;
        this.absolutePath = path.join(pkg.rootDir, this.relativePath);
    }

    public resolve(targetRelativePath: RelativePath): PathInPkg {
        const currentDir = path.dirname(this.relativePath);
        const resolvedRelativePath = path.join(currentDir, targetRelativePath);
        return new PathInPkg(this.pkg, resolvedRelativePath);
    }

    private checkRelativePath(relativePath: RelativePath) {
        // check if the relative path is under the source dir
        const absolutePath = path.join(this.pkg.rootDir, relativePath);
        if (!absolutePath.startsWith(this.pkg.resolvedSourceDir)) {
            throw new Error(`Relative path must be under the source dir: ${relativePath}`);
        }
    }
}

export class TranspilerSession {
    public globalNames?: GlobalVariableNameTable;
    private codeId: number = 0;
    private sessionId: number = 0;
    private moduleId: number = 0;
    private modules: Map<string, GlobalVariableNameTable>;
    private cProlog: string;

    constructor(builtinModulePath: string, cProlog: string) {
        const builtinModule = fs.readFileSync(builtinModulePath, 'utf-8');
        this.globalNames = transpile(this.sessionId++, builtinModule).names;
        this.modules = new Map<string, GlobalVariableNameTable>();
        this.cProlog = cProlog;
    }

    public transpile(project: Project): string[] {
        let entryPath: PathInPkg = new PathInPkg(project.mainPackage, project.mainPackage.entry);
        const src = project.readSourceFile(entryPath.pkg, entryPath.relativePath);
        return this.transpileHelper(project, entryPath, src);
    }

    public transpileFragment(project: Project, src: string) {
        const entryRelativePath = path.join(project.mainPackage.sourceDir, `${this.codeId++}.bs`);
        let entryPath = new PathInPkg(project.mainPackage, entryRelativePath);
        return this.transpileHelper(project, entryPath, src);
    }

    private transpileHelper(project: Project, entryPath: PathInPkg, src: string): string[] {
        const entryPoints: string[] = [];
        const result = transpile(
            this.sessionId++, 
            src, 
            this.globalNames, 
            this.makeImporter(entryPath, entryPoints, project)
        );
        project.writeCFile(entryPath.pkg, entryPath.relativePath, this.cProlog + result.code);
        this.globalNames = result.names;
        entryPoints.push(result.main);
        return entryPoints;
    }

    private makeImporter(currentPath: PathInPkg, entryPoints: string[], project: Project) {
        return (name: string): GlobalVariableNameTable => {
            const newPath = this.resolveImport(currentPath, name, project.dependencies);
            const mod = this.modules.get(newPath.absolutePath);
            project.markDependencyAsUsed(newPath.pkg.name);
            if (mod)
                return mod;
            else {
                const src = project.readSourceFile(newPath.pkg, newPath.relativePath);
                const result = transpile(
                    this.sessionId++, 
                    src, 
                    this.globalNames, 
                    this.makeImporter(newPath, entryPoints, project), 
                    this.moduleId++
                );
                this.modules.set(newPath.absolutePath, result.names);
                entryPoints.push(result.main);
                project.writeCFile(newPath.pkg, newPath.relativePath, this.cProlog + result.code);
                return result.names;
            }
        }
    }

    private resolveImport(currentPath: PathInPkg, importName: string, dependencies: Package[]): PathInPkg {
        if (path.isAbsolute(importName)) {
            throw new Error("This module system does not support importing from absolute paths.");
        } else if (importName.startsWith('.')) { // move in package
            return currentPath.resolve(importName + '.bs');
        } else { // move to new package
            const [pkgName, ...remain] = importName.split('/');
            const pkg = dependencies.find(dep => dep.name === pkgName);
            if (pkg === undefined) {
                throw new Error(`Cannot fine package. Package name: ${pkgName}`);
            }
            const relativePath = remain.length > 0 ? path.join(pkg.sourceDir, `${remain.join('/')}.bs`) : pkg.entry;
            return new PathInPkg(pkg, relativePath);
        }
    }
}