import { describe, expect, it } from '@jest/globals';
import generateMakefile from '../../src/compiler/makefile';
import { PackageConfig } from '../../src/compiler/compiler';

describe('generateMakefile', () => {
  it('should generate a correct Makefile with typical parameters', () => {
    const compilerToolchainDir = '/tools/xtensa-esp32-elf/bin';
    const pkgConfig: PackageConfig = {
        name: 'main',
        espIdfComponents: ['driver', 'core'],
        dependencies: ['gpio'],
        dirs: {
            root: '/Users/foo',
            dist: 'Users/foo/dist',
            build: 'Users/foo/dist/build',
            packages: 'Users/foo/packages',
        }
    };
    const includeDirs = ['src/include', 'components/freertos/include'];
    const targetFilePath = 'dist/lib/libapp.a';

    const makefileContent = generateMakefile(
      compilerToolchainDir,
      pkgConfig,
      includeDirs,
      targetFilePath
    );

    expect(makefileContent).toMatchSnapshot();
  });
});