import { describe, expect, test } from '@jest/globals';
import { generateMakefile, esp32MakefilePreset, hostMakefilePreset } from '../../src/compiler/board-toolchain/tools/makefile';
import { Package } from '../../src/compiler/project';

function createTestPackage(name = 'myapp', rootDir = '/project/myapp'): Package {
    return new Package(
        name,
        {
            rootDir,
            entry: './src/index.bs',
            sourceDir: './src',
            distDir: './dist',
            buildDir: './dist/build',
            packageDir: './packages',
        },
        [],
    );
}

describe('generateMakefile', () => {
    test('generates makefile for esp32 archive file.', () => {
        const pkg = createTestPackage();
        const makefile = generateMakefile(esp32MakefilePreset(
            '/opt/esp-toolchain',
            pkg,
            [
                '/opt/esp-idf/components/freertos/include',
                '/opt/esp-idf/components/esp_common/include',
            ],
            '/project/myapp/dist/build/libmyapp.a',
        ));
        expect(makefile).toMatchSnapshot();
    });

    test('generates makefile for host shared library.', () => {
        const pkg = createTestPackage();
        const makefile = generateMakefile(hostMakefilePreset(
            pkg,
            [
                '/opt/esp-idf/components/freertos/include',
                '/opt/esp-idf/components/esp_common/include',
            ],
            '/project/myapp/dist/build/libmyapp.so',
            []
        ));
        expect(makefile).toMatchSnapshot();
    });
});
