import { execSync } from "child_process";
import { Esp32ToolchainConfig } from "../../src/compiler/board-toolchain/esp32-toolchain";
import { Package, PackageForEsp32 } from "../../src/compiler/project";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function getEsp32CompilerConfig(): Esp32ToolchainConfig {
    const gccPath = execSync('source ~/esp/esp-idf/export.sh &> /dev/null && which xtensa-esp32-elf-gcc').toString();
    const espDir = path.join(os.homedir(), 'esp');
    return {
        runtimeDir: path.resolve(__dirname, '../../../microcontroller'),
        compilerToolchainDir: path.resolve(gccPath, '../'),
        espDir
    }
}

class CompilerTestEnv<P extends Package = Package> {
    readonly root: string;
    readonly resultElf: string;
    private packages = new Map<string, P>();

    constructor(name?: string) {
        this.root = path.resolve(__dirname, `../../temp-files/${name ?? 'compiler-test'}`);
        this.resultElf = path.join(this.root, 'dist/build/main.elf');
    }

    protected addPackage(pkg: P) {
        this.packages.set(pkg.name, pkg);
    }

    public addSourceFile(packageName: string, relativePath: string, code: string) {
        const sourceDir = this.packages.get(packageName)?.sourceDir;
        if (sourceDir) {
            const filePath = path.join(sourceDir, relativePath);
            fs.mkdirSync(path.dirname(filePath), {recursive: true});
            fs.writeFileSync(filePath, code);
        }
        else throw new Error(`Package ${packageName} is not registered.`);
    }

    public getSourceFilePath(packageName: string, relativePath: string) {
        const packageDir = this.packages.get(packageName)?.sourceDir;
        if (packageDir)
            return path.join(packageDir, relativePath);
    }

    public getPackageReader(): (name: string) => P {
        return (name: string) => {
            const config = this.packages.get(name);
            if (config) return config;
            else throw new Error(`Package ${name} is not registered.`);
        }
    }

    public resultElfExists() {
        return fs.existsSync(this.resultElf);
    }

    public init() {
        this.delete();
        fs.mkdirSync(this.root, { recursive: true });
        this.packages = new Map<string, P>();
    }

    public delete() {
        fs.rmSync(this.root, {recursive: true, force: true});
    }
}

export class Esp32CompilerTestEnv extends CompilerTestEnv<PackageForEsp32> {
    public createMainPackage(name: string, dependencies: string[] = [], espIdfComponents: string[] = []): void {
        const pkg: PackageForEsp32 = {
            name,
            entry: "./index.bs",
            sourceDir: this.root,
            distDir: path.join(this.root, 'dist'),
            buildDir: path.join(this.root, 'dist/build'),
            dependencies,
            espIdfComponents,
        }
        super.addPackage(pkg);
    }

    public createSubPackage(name: string, dependencies: string[] = [], espIdfComponents: string[] = []): void {
        const root = path.join(this.root, 'packages', name);
        fs.mkdirSync(root, {recursive: true});
        const pkg: PackageForEsp32 = {
            name,
            entry: "./index.bs",
            sourceDir: root,
            distDir: path.join(root, 'dist'),
            buildDir: path.join(root, 'dist/build'),
            dependencies,
            espIdfComponents,
        }
        super.addPackage(pkg);
    }
}