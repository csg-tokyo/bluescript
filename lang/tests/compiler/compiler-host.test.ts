import * as path from "path";
import * as fs from "fs";
import { ProjectForHost } from "../../src/compiler/project";
import { HostToolchain } from "../../src/compiler/board-toolchain/host-toolchain";
import { HostCompilerTestEnv, runtimeDir } from "./test-utils";
import { SharedObject } from "../../src/compiler/board-toolchain/board-toolchain";
import { CompilerSession } from "../../src/compiler/compiler-session";
import { executeCommand } from "../../src/compiler/utils";

const runtimeBuildDir = path.join(runtimeDir, 'ports/host/build');
const builtinModuleC = path.join(runtimeDir, 'ports/host/std-module.c');
const shellC = path.join(runtimeDir, 'ports/host/shell.c');
const executableShell = path.join(runtimeBuildDir, 'shell');
const runtimeSo = path.join(runtimeBuildDir, 'c-runtime.so');
const runtimeC = path.join(runtimeDir, 'core/src/c-runtime.c');

const buildRuntime = async () => {
    fs.mkdirSync(runtimeBuildDir, { recursive: true });
    await executeCommand('cc', ["-DLINUX64", "-O2", "-shared", "-fPIC", "-o", runtimeSo, runtimeC, builtinModuleC]);
    await executeCommand('cc', ["-DLINUX64", "-O2", "-o", executableShell, shellC, runtimeSo, "-lm", "-ldl"]);
}

const compile = async (testEnv: HostCompilerTestEnv) => {
    const project = ProjectForHost.load(
        testEnv.mainPackageName,
        testEnv.getPackageReader()
    );
    const toolchain = new HostToolchain(runtimeDir);
    const session = new CompilerSession<ProjectForHost, SharedObject>(toolchain);
    await session.buildProject(project);
    return session;
}


describe('Test single compile: Compiler for Host', () => {
    const testEnv = new HostCompilerTestEnv('compiler-host');
    
    beforeAll(async () => {
        await buildRuntime();
    })

    beforeEach(() => {
        testEnv.init();
    });

    afterAll(() => {
        // testEnv.delete();
    });


    it('should compile simple index.bs.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 1');

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should throw error if index.bs does not exist.', async () => {
        testEnv.createMainPackage();

        await expect(compile(testEnv)).rejects.toThrow(`Cannot find a module ${testEnv.getSourceFilePath(testEnv.mainPackageName, './index.bs')}`);
    });

    it('should compile index.bs with std function.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', 'print("hello world")');

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('can change source directory.', async () => {
        testEnv.createMainPackage([], './src', './src/index.bs');
        testEnv.addSourceFile(testEnv.mainPackageName, './src/index.bs', 'print("hello world")');

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('can change entry file.', async () => {
        testEnv.createMainPackage([], './src', './src/main.bs');
        testEnv.addSourceFile(testEnv.mainPackageName, './src/main.bs', 'print("hello world")');

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true); 
    });

    it('should compile index.bs with a module import.', async () => {
        // index.bs <- ./module.bs

        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from './module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should throw error if an imported module does not exist.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from './module1';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`Cannot find a module ${testEnv.getSourceFilePath(testEnv.mainPackageName, './module1.bs')}`);
    });

    it('should throw error if an imported module is imported with absolute path.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addSourceFile(testEnv.mainPackageName, '/index.bs', `import {add} from '${testEnv.getSourceFilePath(testEnv.mainPackageName, './module1.bs')}';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`This module system does not support importing from absolute paths.`);
    });

    it('should throw error if an imported module is imported with a path that is not under the source directory.', async () => {
        testEnv.createMainPackage([], './src');
        testEnv.addSourceFile(testEnv.mainPackageName, './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addSourceFile(testEnv.mainPackageName, './src/index.bs', `import {add} from '../module1';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`Source file must be under the source dir: module1.bs`);
    });

    it('should compile index.bs with module imports chained.', async () => {
        // index.bs <- module1 <- module2

        testEnv.createMainPackage([]);
        testEnv.addSourceFile(testEnv.mainPackageName,
            './module2.bs',
            `export function add(a: integer, b:integer) {return a + b}`
        );
        testEnv.addSourceFile(testEnv.mainPackageName,
            './module1.bs',
            `import {add} from './module2';\nexport function addMul(a: integer, b:integer) {return add(a, b)*add(a, b)}`
        );
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {addMul} from './module1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with module imports from dir.', async () => {
        // index.bs <- dir/module1 <- dir/module2

        testEnv.createMainPackage([]);
        testEnv.addSourceFile(testEnv.mainPackageName,
            './dir/module2.bs',
            `export function add(a: integer, b:integer) {return a + b}`
        );
        testEnv.addSourceFile(testEnv.mainPackageName,
            './dir/module1.bs',
            `import {add} from './module2';\nexport function addMul(a: integer, b:integer) {return add(a, b)*add(a, b)}`
        );
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {addMul} from './dir/module1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with a package import.', async () => {
        // index.bs <- package1

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with a package import 2.', async () => {
        // index.bs <- package1/module1

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1/module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with a package import from different source directory.', async () => {
        testEnv.createSubPackage('package1', [], './src');
        testEnv.addSourceFile('package1', './src/index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with a package import from different source directory and different entry file.', async () => {
        testEnv.createSubPackage('package1', [], './src', './src/main.bs');
        testEnv.addSourceFile('package1', './src/main.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with an unused package.', async () => {
        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `1 + 1;`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with a package import 2.', async () => {
        // index.bs <- package1/module1

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1/module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs with some package imports.', async () => {
        // index.bs <- package1
        //          <- package2

        testEnv.createSubPackage('package2');
        testEnv.addSourceFile('package2', './index.bs', `export function mul(a: integer, b:integer) {return a * b}`);
        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1', 'package2']);
        testEnv.addSourceFile(testEnv.mainPackageName,
            './index.bs',
`import {add} from 'package1';
import {mul} from 'package2'
add(1, 2);
mul(1, 2);`
        );

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should throw error if an imported package does not exist.', async () => {
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`Package package1 is not registered.`);
    });

    it('should compile index.bs with package imports chained.', async () => {
        // index.bs <- package1 <- package2

        testEnv.createSubPackage('package2');
        testEnv.addSourceFile('package2',
            './index.bs',
            `export function add(a: integer, b:integer) {return a + b}`
        );
        testEnv.createSubPackage('package1', ['package2']);
        testEnv.addSourceFile('package1',
            './index.bs',
            `import {add} from 'package2';\nexport function addMul(a: integer, b:integer) {return add(a, b)*add(a, b)}`
        );
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {addMul} from 'package1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs which imports a package with a module import.', async () => {
        // index.bs <- package1 <- package1/module1.bs

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './module1.bs', `export function mul(a: integer, b:integer) {return a * b}`);
        testEnv.addSourceFile('package1',
            './index.bs',
            `import {mul} from './module1';\nexport function addMul(a: integer, b:integer) {return mul(a, b)+mul(a, b)}`
        );
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {addMul} from 'package1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs which imports a package and a module.', async () => {
        // index.bs <- package1
        //          <- ./module1.bs

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1',
            './index.bs',
            `export function add(a: integer, b:integer) {return a + b;}`
        );
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './module1.bs', `export function mul(a: integer, b:integer) {return a * b}`);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `
import { add } from 'package1';
// import { mul } from './module1';

add(1, 2);
// mul(1,2);
        `);
        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should treat a class imported via different routes as the same class.', async () => {
        // package1 <- package2
        // index.bs <- package1
        //          <- package2
        // Shape from package2 in package1 and Shape from package2 in main should be treated as same class.

        testEnv.createSubPackage('package2');
        testEnv.addSourceFile('package2', './index.bs', `export class Shape {constructor() {}}`);
        testEnv.createSubPackage('package1', ['package2']);
        testEnv.addSourceFile('package1', './index.bs', `
import { Shape } from 'package2';
export function getShapeArea(shape: Shape) {return 110;}
`);
        testEnv.createMainPackage(['package1', 'package2']);
        testEnv.addSourceFile(testEnv.mainPackageName,
            './index.bs',
`import { getShapeArea } from 'package1';
import { Shape } from 'package2';

const shape = new Shape();
getShapeArea(shape);
`
        );
        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs which includes c file.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `
code\`#include<stdio.h>\`
function foo() {
    code\`puts("foo");\`
}
            `);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs which includes custom c file.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './add.c',  'int add(int a, int b) {return a + b;}')
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `
code\`#include "./add.c"\`
function foo() {
    code\`add(1, 2);\`
}
            `);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

    it('should compile index.bs which includes custom header file.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './add.h', 'int add(int a, int b);');
        testEnv.addSourceFile(testEnv.mainPackageName, './add.c', `#include "add.h"\nint add(int a, int b) {return a + b;}`);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `
code\`#include "add.h"\`
function foo() {
    code\`add(1, 2);\`
}
            `);

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
        expect(fs.existsSync(path.join(testEnv.root, 'dist/add.h'))).toBe(true);
    });

    it('should throw C compilation error.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `
function foo() {
    code\`puts("foo");\`
}
            `);

        await expect(compile(testEnv)).rejects.toThrow(`do not support implicit function declarations`);
    });

    it('should compile index.bs again after editing file.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 1');

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);

        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 3');

        await compile(testEnv);
        expect(testEnv.resultSharedObjectExists()).toBe(true);
    });

});