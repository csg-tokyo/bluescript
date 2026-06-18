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
	public readonly dependencies: Map<string, P>;
    private usedDependenciesMap = new Map<string, P>();
    
    protected constructor(mainPackage: P, dependencies: Map<string, P>) {
        this.mainPackage = mainPackage;
        this.dependencies = dependencies;
    }

    get usedDependencies() {
        return [...this.usedDependenciesMap.values()];
    }

    protected static loadHelper<P extends Package>(
        mainPackageName: string,
        packageReader: (name: string) => P
    ) {
        const mainPackage = packageReader(mainPackageName);
        const dependencies = new Map<string, P>();
        const tmpQueue = [...mainPackage.dependencies];
        const visited = new Set<string>(mainPackage.dependencies);

        while (tmpQueue.length > 0) {
            const currName = tmpQueue.shift() as string;
            const pkg = packageReader(currName);
            dependencies.set(pkg.name, pkg);

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
        for (const dep of this.dependencies.values()) {
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

    addUsedDependency(pkg: P) {
        if (pkg.name !== this.mainPackage.name) {
            this.usedDependenciesMap.set(pkg.name, pkg);
        }
    }

    archiveFile(pkg: Package): AbsolutePath { 
        return path.join(pkg.resolvedBuildDir, `lib${pkg.name}.a`); 
    }
}


export class ProjectForEsp32 extends Project<PackageForEsp32> {
    private constructor(mainPackage: PackageForEsp32, dependencies: Map<string, PackageForEsp32>) {
        super(mainPackage, dependencies);
    }

    public static load(
        mainPackageName: string,
        packageReader: (name: string) => PackageForEsp32,
    ): ProjectForEsp32 {
        const project = Project.loadHelper<PackageForEsp32>(mainPackageName, packageReader);
        return new ProjectForEsp32(project.mainPackage, project.dependencies);
    }

    writeLinkerScript(data: string) {
        const filePath = path.join(this.mainPackage.resolvedBuildDir, "linkerscript.ld");
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    elfFile(): AbsolutePath { 
        return path.join(
            this.mainPackage.resolvedBuildDir, 
            `${this.mainPackage.name}.elf`
        ); 
    }
}


export class ProjectForHost extends Project<Package> {
    private constructor(mainPackage: Package, dependencies: Map<string, Package>) {
        super(mainPackage, dependencies);
    }

    public static load(
        mainPackageName: string,
        packageReader: (name: string) => Package,
    ): ProjectForHost {
        const project = Project.loadHelper<Package>(mainPackageName, packageReader);
        return new ProjectForHost(project.mainPackage, project.dependencies);
    }

    soFile(id?: number): AbsolutePath {
        return path.join(
            this.mainPackage.resolvedBuildDir, 
            `${this.mainPackage.name}${id ?? ''}.so`
        ); 
    }
}