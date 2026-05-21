import * as fs from "fs";
import * as path from "path";


export interface Package {
    name: string;
    entry: string;
    sourceDir: string;
    distDir: string;
    buildDir: string;
    dependencies: string[];
}

export interface PackageForEsp32 extends Package {
    espIdfComponents: string[];
}

export class Project<P extends Package = Package> {
    public readonly projectDir: string;
	public readonly mainPackage: P;
	public readonly dependencies: P[];
    public readonly packageDir: string;
    
    constructor(mainPackage: P, dependencies: P[], projectDir: string) {
        this.mainPackage = mainPackage;
        this.dependencies = dependencies;
        this.projectDir = projectDir;
        this.packageDir = path.join(projectDir, 'packages');
    }

    public static load<P extends Package>(
        projectDir: string,
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

        return new Project<P>(mainPackage, dependencies, projectDir);
    }

	check() {
        const invalidFilePattern = /^\d+\.bs$/;
        if (!fs.existsSync(this.mainPackage.sourceDir)) {
            return;
        }
        const files = fs.readdirSync(this.mainPackage.sourceDir);

        for (const file of files) {
            if (invalidFilePattern.test(file)) {
                const fullPath = path.join(this.mainPackage.sourceDir, file);
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
        fs.rmSync(pkg.distDir, { recursive: true, force: true });
    }

    readSourceFile(pkg: Package, relativePath: string): string {
        const filePath = path.join(pkg.sourceDir, relativePath);
        try {
            return fs.readFileSync(filePath).toString('utf-8');
        }
        catch (e) {
            throw new Error(`Cannot find a module ${filePath} in ${pkg.name}`);
        }
    }

    writeCFile(pkg: Package, relativeSourceFilePath: string, data: string) {
        const parsed = path.parse(relativeSourceFilePath);
        const cRelativePath = path.join(parsed.dir, `bs_${parsed.name}.c`);
        const filePath = path.join(pkg.distDir, cRelativePath);
        const cDir = path.dirname(filePath);
        fs.mkdirSync(cDir, { recursive: true });
        fs.writeFileSync(filePath, data);
    }

    writeMakefile(pkg: P, data: string) {
        const filePath = path.join(pkg.distDir, 'Makefile');
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    writeLinkerScript(data: string) {
        const filePath = path.join(this.mainPackage.buildDir, "linkerscript.ld");
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    archivePath(pkg: P) { return path.join(pkg.buildDir, `lib${pkg.name}.a`); }
    elfPath() { return path.join(this.mainPackage.buildDir, `${this.mainPackage.name}.elf`); }
}