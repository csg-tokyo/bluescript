import { execSync } from "child_process";
import { PackageConfig } from "../../src/compiler/compiler";
import * as fs from 'fs';
import * as path from 'path';

export function getCompilerConfig() {
    const gccPath = execSync('source ~/esp/esp-idf/export.sh &> /dev/null && which xtensa-esp32-elf-gcc').toString();
    return {
        dirs: {
            runtime: path.resolve(__dirname, '../../../microcontroller'),
            compilerToolchain: path.resolve(gccPath, '../'),
            std: path.resolve(__dirname, '../../../modules/std'),
        }
    }
}

export default class CompilerTestEnv {
    static readonly ROOT_DIR = path.resolve(__dirname, '../../temp-files/compiler-test');
    static readonly RESULT_FILE = path.resolve(__dirname, '../../temp-files/compiler-test/dist/build/main.elf');
    private packageConfigs = new Map<string, PackageConfig>();

    public addPackage(name: string, dependencies: string[] = [], espIdfComponents: string[] = []) {
        const packageDir = name === 'main' ? path.join(CompilerTestEnv.ROOT_DIR) : path.join(CompilerTestEnv.ROOT_DIR, 'packages', name);
        fs.mkdirSync(packageDir, {recursive: true});
        this.packageConfigs.set(name, {
            name, espIdfComponents, dependencies,
            dirs: {
                root: packageDir,
                dist: path.join(packageDir, 'dist'),
                build: path.join(packageDir, 'dist/build'),
                packages: path.join(CompilerTestEnv.ROOT_DIR, 'packages')
            }
        });
    }

    public addFile(packageName: string, relativePath: string, code: string) {
        const packageDir = this.packageConfigs.get(packageName)?.dirs.root;
        if (packageDir) {
            const filePath = path.join(packageDir, relativePath);
            fs.mkdirSync(path.dirname(filePath), {recursive: true});
            fs.writeFileSync(filePath, code);
        }
        else throw new Error(`Package ${packageName} is not registered.`);
    }

    public getFilePath(packageName: string, relativePath: string) {
        const packageDir = this.packageConfigs.get(packageName)?.dirs.root;
        if (packageDir)
            return path.join(packageDir, relativePath);
    }

    public getPackageReader(): (name: string)=>PackageConfig {
        return (name: string) => {
            const config = this.packageConfigs.get(name);
            if (config) return config;
            else throw new Error(`Package ${name} is not registered.`);
        }
    }

    public clean() {
        fs.rmSync(CompilerTestEnv.ROOT_DIR, {recursive: true});
    }
}