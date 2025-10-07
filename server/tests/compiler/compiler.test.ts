import * as fs from 'fs';
import CompilerTestEnv, {getCompilerConfig} from './compiler-test-utils';
import { Compiler } from '../../src/compiler/compiler';

const memoryLayout = {
    iram:{address:0x400a0144, size:10000},
    dram:{address:0x3ffd5b04, size:10000},
    iflash:{address:0x40150000, size:10000},
    dflash:{address:0x3f43d000, size:10000},
}


describe('Compiler for ESP32', () => {
    const compilerConfig = getCompilerConfig();
    const compile = async (testEnv: CompilerTestEnv) => {
        const compiler = new Compiler(
            memoryLayout,
            compilerConfig,
            testEnv.getPackageReader()
        )
        await compiler.compile();
    }

    beforeEach(() => {
        if (fs.existsSync(CompilerTestEnv.ROOT_DIR)) {
            fs.rmSync(CompilerTestEnv.ROOT_DIR, {recursive: true});
        }
    })


    it('should compile simple index.bs.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './index.bs', '1 + 1');

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should throw error if index.bs does not exist.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');

        await expect(compile(testEnv)).rejects.toThrow(`Cannot find a module ${testEnv.getFilePath('main', './index.bs')}`);

        testEnv.clean();
    });

    it('should compile index.bs with std function.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './index.bs', 'print("hello world")');

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should compile index.bs with a module import.', async () => {
        // index.bs <- ./module.bs
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addFile('main', './index.bs', `import {add} from './module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should throw error if an imported module does not exist.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './index.bs', `import {add} from './module1';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`Cannot find a module ${testEnv.getFilePath('main', './module1.bs')}`);

        testEnv.clean();
    });

    it('should throw error if an imported module is imported with absolute path.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addFile('main', '/index.bs', `import {add} from '${testEnv.getFilePath('main', './module1.bs')}';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`This module system does not support importing from absolute paths.`);

        testEnv.clean();
    });

    it('should compile index.bs with module imports chained.', async () => {
        // index.bs <- module1 <- module2
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main', []);
        testEnv.addFile('main',
            './module2.bs',
            `export function add(a: integer, b:integer) {return a + b}`
        );
        testEnv.addFile('main',
            './module1.bs',
            `import {add} from './module2';\nexport function addMul(a: integer, b:integer) {return add(a, b)*add(a, b)}`
        );
        testEnv.addFile('main', './index.bs', `import {addMul} from './module1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should compile index.bs with module imports from dir.', async () => {
        // index.bs <- dir/module1 <- dir/module2
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main', []);
        testEnv.addFile('main',
            './dir/module2.bs',
            `export function add(a: integer, b:integer) {return a + b}`
        );
        testEnv.addFile('main',
            './dir/module1.bs',
            `import {add} from './module2';\nexport function addMul(a: integer, b:integer) {return add(a, b)*add(a, b)}`
        );
        testEnv.addFile('main', './index.bs', `import {addMul} from './dir/module1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should compile index.bs with a package import.', async () => {
        // index.bs <- package1
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('package1');
        testEnv.addFile('package1', './index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addPackage('main', ['package1']);
        testEnv.addFile('main', './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should compile index.bs with a package import 2.', async () => {
        // index.bs <- package1/module1
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('package1');
        testEnv.addFile('package1', './module1.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addPackage('main', ['package1']);
        testEnv.addFile('main', './index.bs', `import {add} from 'package1/module1';\nadd(1, 2);`);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should compile index.bs with some package imports.', async () => {
        // index.bs <- package1
        //          <- package2
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('package2');
        testEnv.addFile('package2', './index.bs', `export function mul(a: integer, b:integer) {return a * b}`);
        testEnv.addPackage('package1');
        testEnv.addFile('package1', './index.bs', `export function add(a: integer, b:integer) {return a + b}`);
        testEnv.addPackage('main', ['package1', 'package2']);
        testEnv.addFile('main',
            './index.bs',
`import {add} from 'package1';
import {mul} from 'package2'
add(1, 2);
mul(1, 2);`
        );

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should throw error if an imported package does not exist.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main', ['package1']);
        testEnv.addFile('main', './index.bs', `import {add} from 'package1';\nadd(1, 2);`);

        await expect(compile(testEnv)).rejects.toThrow(`Package package1 is not registered.`);

        testEnv.clean();
    });

    it('should compile index.bs with package imports chained.', async () => {
        // index.bs <- package1 <- package2
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('package2');
        testEnv.addFile('package2',
            './index.bs',
            `export function add(a: integer, b:integer) {return a + b}`
        );
        testEnv.addPackage('package1', ['package2']);
        testEnv.addFile('package1',
            './index.bs',
            `import {add} from 'package2';\nexport function addMul(a: integer, b:integer) {return add(a, b)*add(a, b)}`
        );
        testEnv.addPackage('main', ['package1']);
        testEnv.addFile('main', './index.bs', `import {addMul} from 'package1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should compile index.bs which imports a package with a module import.', async () => {
        // index.bs <- package1 <- package1/module1.bs
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('package1');
        testEnv.addFile('package1', './module1.bs', `export function mul(a: integer, b:integer) {return a * b}`);
        testEnv.addFile('package1',
            './index.bs',
            `import {mul} from './module1';\nexport function addMul(a: integer, b:integer) {return mul(a, b)+mul(a, b)}`
        );
        testEnv.addPackage('main', ['package1']);
        testEnv.addFile('main', './index.bs', `import {addMul} from 'package1';\naddMul(1, 2);`);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should compile index.bs which includes c file.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './index.bs', `
code\`#include<stdio.h>\`
function foo() {
    code\`puts("foo");\`
}
            `);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should throw C compilation error.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './index.bs', `
function foo() {
    code\`puts("foo");\`
}
            `);

        await expect(compile(testEnv)).rejects.toThrow(`implicit declaration of function 'puts'`);

        testEnv.clean();
    });

    it('should compile index.bs which includes a ESP-IDF component.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main', [], ['esp_driver_gpio']);
        testEnv.addFile('main', './index.bs', `
code\`#include "driver/gpio.h"\`
function gpioInit(pin: integer) {
    code\`gpio_set_direction(\${pin}, GPIO_MODE_OUTPUT);\`
}
gpioInit(23);
            `);

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });

    it('should throw error if a specified ESP-IDF component does not exist.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main', [], ['foo']);
        testEnv.addFile('main', './index.bs', `1 + 1`);

        await expect(compile(testEnv)).rejects.toThrow(`foo does not exists in ESP-IDF components.`);

        testEnv.clean();
    });

    it('should compile index.bs again after editing file.', async () => {
        const testEnv = new CompilerTestEnv();
        testEnv.addPackage('main');
        testEnv.addFile('main', './index.bs', '1 + 1');

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.addFile('main', './index.bs', '1 + 3');

        await compile(testEnv);
        expect(fs.existsSync(CompilerTestEnv.RESULT_FILE)).toBe(true);

        testEnv.clean();
    });
})