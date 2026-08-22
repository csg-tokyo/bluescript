import * as fs from "fs";
import * as path from "path";


type RelativePath = string;
type AbsolutePath = string;

/** Compiler response file holding the include dirs and compile flags. */
export const COMPILE_FLAGS_FILE = 'compile-flags.rsp';


export class Package {
    readonly name: string;
    readonly rootDir: AbsolutePath;
    readonly entry: RelativePath;
    readonly sourceDir: RelativePath;
    readonly distDir: RelativePath;
    readonly buildDir: RelativePath;
    readonly packageDir: RelativePath;
    readonly dependencies: string[];

    get resolvedEntry(): AbsolutePath { return path.join(this.rootDir, this.entry); }  
    get resolvedSourceDir(): AbsolutePath { return path.join(this.rootDir, this.sourceDir); }
    get resolvedDistDir(): AbsolutePath { return path.join(this.rootDir, this.distDir); }
    get resolvedBuildDir(): AbsolutePath { return path.join(this.rootDir, this.buildDir); }
    get resolvedPackageDir(): AbsolutePath { return path.join(this.rootDir, this.packageDir); }
    get archiveFile(): AbsolutePath { return path.join(this.resolvedBuildDir, `lib${this.name}.a`); }
    get objectFiles(): AbsolutePath[] {
        const objects: AbsolutePath[] = [];
        this.walkFiles(this.resolvedDistDir, (name, fullPath) => {
            if (fullPath.endsWith('.c')) {
                objects.push(this.toObjectFile(fullPath));
            }
        }, [this.resolvedBuildDir]);
        return objects;
    }
    get headerFilesInDist(): AbsolutePath[] {
        const headers: AbsolutePath[] = [];
        this.walkFiles(this.resolvedDistDir, (name, fullPath) => {
            if (fullPath.endsWith('.h')) {
                headers.push(fullPath);
            }
        }, [this.resolvedBuildDir]);
        return headers;
    }

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

    check() {
        const invalidBsFilePattern = /^\d+\.bs$/;
        const invalidCFilePattern = /^bs_.*\.c$/;
        if (!fs.existsSync(this.sourceDir)) {
            return;
        }
        this.walkFiles(this.resolvedSourceDir, (name, fullPath) => {
            if (invalidBsFilePattern.test(name)) {
                throw new Error(
                    `Invalid file name: ${fullPath}\n` +
                    `BlueScript source file names cannot consist solely of digits.`
                );
            }
            if (invalidCFilePattern.test(name)) {
                throw new Error(
                    `Invalid file name: ${fullPath}\n` +
                    `You cannot use 'bs_' prefix for C source file names.`
                );
            }
        }, [this.resolvedDistDir, this.packageDir]);
    }

    copyNativeFilesToDist() {
        this.walkFiles(this.resolvedSourceDir, (name, fullPath) => {
            if (name.endsWith('.c') || name.endsWith('.h')) {
                const dest = this.replacePrefix(this.resolvedSourceDir, this.resolvedDistDir, fullPath);
                fs.cpSync(fullPath, dest);
            }
        }, [this.resolvedDistDir, this.packageDir]);
    }

    clean(): void {
        fs.rmSync(this.resolvedDistDir, { recursive: true, force: true });
    }

    readSourceFile(p: RelativePath): string {
        const filePath = path.join(this.rootDir, p);
        try {
            return fs.readFileSync(filePath).toString('utf-8');
        }
        catch (e) {
            throw new Error(`Cannot find a module ${filePath} in ${this.name}`);
        }
    }

    writeCFile(srcPath: RelativePath, data: string) {
        const parsed = path.parse(srcPath);
        const cRelativePath = path.join(parsed.dir, `bs_${parsed.name}.c`);
        const filePath = path.join(this.resolvedDistDir, cRelativePath);
        const cDir = path.dirname(filePath);
        fs.mkdirSync(cDir, { recursive: true });
        fs.writeFileSync(filePath, data);
    }

    writeMakefile(data: string) {
        const filePath = path.join(this.resolvedDistDir, 'Makefile');
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    writeCompileFlagsFile(data: string) {
        const filePath = path.join(this.resolvedDistDir, COMPILE_FLAGS_FILE);
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    // Creates every directory the generated Makefile writes into. The Makefile
    // itself cannot do this because its recipes run through cmd.exe on Windows,
    // where 'mkdir -p' is not available.
    ensureBuildDirs() {
        const dirs = new Set<string>([this.resolvedBuildDir]);
        for (const objectFile of this.objectFiles) {
            dirs.add(path.dirname(objectFile));
        }
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // Removes the transpiler-generated C files (bs_*.c) from the dist dir.
    // Used for incremental (REPL) builds so that each fragment is compiled into
    // a shared library containing only its own object, referencing symbols of
    // previous fragments from their shared libraries instead of statically
    // redefining them. Native (user-provided) C files are left untouched.
    removeGeneratedCFiles() {
        if (!fs.existsSync(this.resolvedDistDir)) {
            return;
        }
        const generatedCFilePattern = /^bs_.*\.c$/;
        this.walkFiles(this.resolvedDistDir, (name, fullPath) => {
            if (generatedCFilePattern.test(name)) {
                fs.rmSync(fullPath, { force: true });
            }
        }, [this.resolvedBuildDir]);
    }
    
    protected walkFiles(dir: string, handler: (name: string, fullPath: string) => void, ignorDirs?: string[]) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (ignorDirs?.includes(fullPath)) {
                    continue;
                }
                this.walkFiles(fullPath, handler, ignorDirs);
            } else if (entry.isFile()) {
                handler(entry.name, fullPath);
            }
        }
    }

    protected toObjectFile(cFileInDist: AbsolutePath): AbsolutePath {
        const source = cFileInDist;
        const dist = this.resolvedDistDir;
        const prefix = dist.endsWith(path.sep) ? dist : dist + path.sep;
        if (!source.startsWith(prefix) || !source.endsWith(".c")) {
            throw new Error(`Invalid dist source: ${source}`);
        }
        const relative = source.slice(prefix.length, -2); // remove ".c"
        return path.join(this.resolvedBuildDir, `${relative}.o`);
    }

    protected replacePrefix(fromDir: AbsolutePath, toDir: AbsolutePath, filePath: AbsolutePath): string {
        if (filePath === fromDir) return toDir;
        const prefix = filePath.endsWith(path.sep) ? fromDir : fromDir + path.sep;
        if (!filePath.startsWith(prefix)) {
            throw new Error(`Path ${filePath} is not under ${fromDir}`);
        }
        return toDir + "/" + filePath.slice(prefix.length);
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

    get elfFile(): AbsolutePath { 
        return path.join(this.resolvedBuildDir, `${this.name}.elf`); 
    }

    writeLinkerScript(data: string) {
        const filePath = path.join(this.resolvedBuildDir, "linkerscript.ld");
        fs.writeFileSync(filePath, data);
        return filePath;
    }
}

export class PackageForHostUnix extends Package {
    soFile(id?: number): AbsolutePath {
        return path.join(
            this.resolvedBuildDir, 
            `${this.name}${id ?? ''}.so`
        ); 
    }
}

export class PackageForHostWindows extends Package {
    dllFile(id?: number): AbsolutePath {
        return path.join(
            this.resolvedBuildDir, 
            `${this.name}${id ?? ''}.dll`
        ); 
    }
}

