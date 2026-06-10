import * as fs from "fs";
import * as path from "path";


export type RelativePath = string;
export type AbsolutePath = string;

export class Package {
    public readonly name: string;
    public readonly rootDir: AbsolutePath;
    public readonly entry: RelativePath;
    public readonly sourceDir: RelativePath;
    public readonly distDir: RelativePath;
    public readonly buildDir: RelativePath;
    public readonly packageDir: RelativePath;
    public readonly dependencies: string[];

    public get resolvedEntry(): AbsolutePath { return path.join(this.rootDir, this.entry); }  
    public get resolvedSourceDir(): AbsolutePath { return path.join(this.rootDir, this.sourceDir); }
    public get resolvedDistDir(): AbsolutePath { return path.join(this.rootDir, this.distDir); }
    public get resolvedBuildDir(): AbsolutePath { return path.join(this.rootDir, this.buildDir); }
    public get resolvedPackageDir(): AbsolutePath { return path.join(this.rootDir, this.packageDir); }

    constructor(
        name: string,
        path: {
            rootDir: AbsolutePath,
            entry: RelativePath,
            sourceDir: RelativePath,
            distDir: RelativePath,
            buildDir: RelativePath,
            packageDir: RelativePath,
        },
        dependencies: string[],
    ) {
        this.name = name;
        this.dependencies = dependencies;
        this.rootDir = path.rootDir;
        this.sourceDir = path.sourceDir;
        this.entry = path.entry;
        this.distDir = path.distDir;
        this.buildDir = path.buildDir;
        this.packageDir = path.packageDir;
    }
}

export class PackageForEsp32 extends Package {
    public readonly espIdfComponents: string[];

    constructor(
        name: string,
        path: {
            rootDir: AbsolutePath,
            entry: RelativePath,
            sourceDir: RelativePath,
            distDir: RelativePath,
            buildDir: RelativePath,
            packageDir: RelativePath,
        },
        dependencies: string[],
        espIdfComponents: string[],
    ) {
        super(name, path, dependencies);
        this.espIdfComponents = espIdfComponents;
    }
}

export class Project<P extends Package = Package> {
	public readonly mainPackage: P;
	public readonly dependencies: (P & { used?: boolean })[];
    
    constructor(mainPackage: P, dependencies: P[]) {
        this.mainPackage = mainPackage;
        this.dependencies = dependencies;
    }

    public static load<P extends Package>(
        mainPackageName: string,
        packageReader: (name: string) => P
    ) {
        const mainPackage = packageReader(mainPackageName);
        const dependencies: P[] = [];
        const tmpQueue = [...mainPackage.dependencies];
        const visited = new Set<string>(mainPackage.dependencies);

        while (tmpQueue.length > 0) {
            const currName = tmpQueue.shift() as string;
            const pkg = packageReader(currName);
            dependencies.push(pkg);

            for (const depName of pkg.dependencies) {
                if (!visited.has(depName)) {
                    visited.add(depName);
                    tmpQueue.push(depName);
                }
            }
        }

        return new Project<P>(mainPackage, dependencies);
    }

	check() {
        const invalidFilePattern = /^\d+\.bs$/;
        if (!fs.existsSync(this.mainPackage.sourceDir)) {
            return;
        }
        const files = fs.readdirSync(this.mainPackage.resolvedSourceDir);

        for (const file of files) {
            if (invalidFilePattern.test(file)) {
                const fullPath = path.join(this.mainPackage.resolvedSourceDir, file);
                throw new Error(
                    `Invalid file name: ${fullPath}\n` +
                    `BlueScript source file names cannot consist solely of digits.`
                );
            }
        }
    }

	clean() {
        this.cleanDistDir(this.mainPackage);
        for (const dep of this.dependencies) {
            this.cleanDistDir(dep);
        }
    }

    private cleanDistDir(pkg: P): void {
        fs.rmSync(pkg.resolvedDistDir, { recursive: true, force: true });
    }

    readSourceFile(pkg: P, relativePath: RelativePath): string {
        const filePath = path.join(pkg.rootDir, relativePath);
        try {
            return fs.readFileSync(filePath).toString('utf-8');
        }
        catch (e) {
            throw new Error(`Cannot find a module ${filePath} in ${pkg.name}`);
        }
    }

    writeCFile(pkg: P, relativeSourceFilePath: RelativePath, data: string) {
        const parsed = path.parse(relativeSourceFilePath);
        const cRelativePath = path.join(parsed.dir, `bs_${parsed.name}.c`);
        const filePath = path.join(pkg.resolvedDistDir, cRelativePath);
        const cDir = path.dirname(filePath);
        fs.mkdirSync(cDir, { recursive: true });
        fs.writeFileSync(filePath, data);
    }

    writeMakefile(pkg: P, data: string) {
        const filePath = path.join(pkg.resolvedDistDir, 'Makefile');
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    writeLinkerScript(data: string) {
        const filePath = path.join(this.mainPackage.resolvedBuildDir, "linkerscript.ld");
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    markDependencyAsUsed(name: string) {
        const dependency = this.dependencies.find(dep => dep.name === name);
        if (dependency) {
            dependency.used = true;
        }
    }

    archivePath(pkg: P) { 
        return path.join(pkg.resolvedBuildDir, `lib${pkg.name}.a`); 
    }

    elfPath() { 
        return path.join(
            this.mainPackage.resolvedBuildDir, 
            `${this.mainPackage.name}.elf`
        ); 
    }
}