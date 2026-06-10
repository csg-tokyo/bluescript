import { getEsp32CompilerConfig, Esp32CompilerTestEnv } from './test-utils';
import { CompilerSession } from '../../src/compiler/compiler-session';
import { PackageForEsp32, Project } from '../../src/compiler/project';
import { Esp32Toolchain } from '../../src/compiler/board-toolchain/esp32-toolchain';

const memoryLayout = {
    iram: { address: 0x400a0144, size: 10000 },
    dram: { address: 0x3ffd5b04, size: 10000 },
    iflash: { address: 0x40150000, size: 10000 },
    dflash: { address: 0x3f43d000, size: 10000 },
}
const compilerConfig = getEsp32CompilerConfig();

const compile = async (testEnv: Esp32CompilerTestEnv) => {
    const project = Project.load<PackageForEsp32>(
        testEnv.mainPackageName,
        testEnv.getPackageReader()
    );
    const toolchain = new Esp32Toolchain(compilerConfig, memoryLayout);
    const session = new CompilerSession(toolchain);
    await session.buildProject(project);
    return session;
}


describe('Test single compile: Compiler for ESP32', () => {
    const testEnv = new Esp32CompilerTestEnv();

    beforeEach(() => {
        testEnv.init();
    });

    afterAll(() => {
        testEnv.delete();
    });


    it('should compile simple index.bs.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 1');

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should throw error if index.bs does not exist.', async () => {
        testEnv.createMainPackage();

        await expect(compile(testEnv)).rejects.toThrow(`Cannot find a module ${testEnv.getSourceFilePath(testEnv.mainPackageName, './index.bs')}`);
    });

    it('should compile index.bs with std function.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', 'print("hello world")');

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('can change source directory.', async () => {
        testEnv.createMainPackage([], [], './src');
        testEnv.addSourceFile(testEnv.mainPackageName, './src/index.bs', 'print("hello world")');

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should compile index.bs with a module import.', async () => {
        // index.bs <- ./module.bs

        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from './module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
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
        testEnv.createMainPackage([], [], './src');
        testEnv.addSourceFile(testEnv.mainPackageName, './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addSourceFile(testEnv.mainPackageName, './src/index.bs', `import {add} from '../module1';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`Relative path must be under the source dir: module1.bs`);
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
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should compile index.bs with a package import.', async () => {
        // index.bs <- package1

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should compile index.bs with a package import 2.', async () => {
        // index.bs <- package1/module1

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1/module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should compile index.bs with a package import from different source directory.', async () => {
        testEnv.createSubPackage('package1', [], [], './src');
        testEnv.addSourceFile('package1', './src/index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should compile index.bs with an unused package.', async () => {
        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `1 + 1;`);

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should compile index.bs with a package import 2.', async () => {
        // index.bs <- package1/module1

        testEnv.createSubPackage('package1');
        testEnv.addSourceFile('package1', './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.createMainPackage(['package1']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `import {add} from 'package1/module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
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
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should throw C compilation error.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `
function foo() {
    code\`puts("foo");\`
}
            `);

        await expect(compile(testEnv)).rejects.toThrow(`implicit declaration of function 'puts'`);
    });

    it('should compile index.bs which includes a ESP-IDF component.', async () => {

        testEnv.createMainPackage([], ['esp_driver_gpio']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `
code\`#include "driver/gpio.h"\`
function gpioInit(pin: integer) {
    code\`gpio_set_direction(\${pin}, GPIO_MODE_OUTPUT);\`
}
gpioInit(23);
            `);

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });

    it('should throw error if a specified ESP-IDF component does not exist.', async () => {
        testEnv.createMainPackage([], ['foo']);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `1 + 1`);

        await expect(compile(testEnv)).rejects.toThrow(`foo does not exists in ESP-IDF components.`);
    });

    it('should compile index.bs again after editing file.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 1');

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);

        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 3');

        await compile(testEnv);
        expect(testEnv.resultElfExists()).toBe(true);
    });
});


describe('Test additional compile: Compiler for ESP32', () => {
    const testEnv = new Esp32CompilerTestEnv();

    beforeEach(() => {
        testEnv.init();
    });

    // afterAll(() => {
    //     testEnv.delete();
    // });

    it('should throw error if a file with a name consisting only numbers exists in main.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 1');
        testEnv.addSourceFile(testEnv.mainPackageName, './1.bs', '1 + 1');

        await expect(compile(testEnv)).rejects.toThrow(`Invalid file name`);
    });

    it('should compile an additional code fragment.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 1');

        const session = await compile(testEnv);
        const binary = await session.compileFragment('1 + 23');
        expect(binary.iflash).toBeDefined();
        expect(binary.iflash?.address).not.toBe(memoryLayout.iflash.size);
        expect(binary.entryPoints.length).toBe(1);
    });

    it('should compile an additional code fragment with function call.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', 'function add(a, b) {return a + b}');

        const session = await compile(testEnv);
        const binary = await session.compileFragment('add(2, 3);');
        expect(binary.entryPoints.length).toBe(1);
    });

    it('should compile an additional code fragment with variable access', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', 'let a = 1 + 1;');

        const session = await compile(testEnv);
        const binary = await session.compileFragment('a += 1;');
        expect(binary.entryPoints.length).toBe(1);
    });

    it('should compile an additional code fragment with a module import.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', `1 + 1`);

        const session = await compile(testEnv);
        const binary = await session.compileFragment(`import {add} from './module1';\n add(1, 1);`);
        expect(binary.entryPoints.length).toBe(2);
    });

    it('should compile several additional code fragments.', async () => {
        testEnv.createMainPackage();
        testEnv.addSourceFile(testEnv.mainPackageName, './index.bs', '1 + 1');

        const session = await compile(testEnv);
        let binary = await session.compileFragment('function add(a, b) {return a + b}');
        expect(binary.entryPoints.length).toBe(1);
        binary = await session.compileFragment('add(1, 2);');
        expect(binary.entryPoints.length).toBe(1);
    });
});
