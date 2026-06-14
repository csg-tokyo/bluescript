import { HostCompilerAdapter } from '../../src/platforms/compiler/host-compiler-adapter';
import { GlobalConfigHandler } from '../../src/config/global-config';
import { ProjectConfigHandler } from '../../src/config/project-config';

jest.mock('@bscript/lang', () => {
    const actual = jest.requireActual('@bscript/lang');
    return {
        ...actual,
        CompilerSession: jest.fn().mockImplementation(() => ({
            buildProject: jest.fn().mockResolvedValue({
                soFile: '/project/dist/build/app.so',
                entryNames: [{ isMain: true, name: 'app' }],
            }),
            compileFragment: jest.fn().mockResolvedValue({
                soFile: '/project/dist/build/app-0.so',
                entryNames: [{ isMain: true, name: 'app' }],
            }),
        })),
        HostToolchain: jest.fn(),
        ProjectForHost: {
            load: jest.fn().mockReturnValue({}),
        },
    };
});

describe('HostCompilerAdapter', () => {
    const globalConfigHandler = GlobalConfigHandler.fromObject({
        version: '1.0.0',
        runtimeDir: '/mock/runtime',
        boards: {
            host: { buildDir: '/mock/host/build' },
        },
    });
    const projectConfigHandler = ProjectConfigHandler.createTemplate('app', 'host', '/project');

    it('should throw when host board is not set up', () => {
        const unsetGlobalConfig = GlobalConfigHandler.fromObject({
            version: '1.0.0',
            runtimeDir: '/mock/runtime',
            boards: {},
        });

        expect(() => new HostCompilerAdapter(unsetGlobalConfig, projectConfigHandler))
            .toThrow('The environment for host is not set up.');
    });

    it('should build project without memory layout', async () => {
        const adapter = new HostCompilerAdapter(globalConfigHandler, projectConfigHandler);
        const output = await adapter.buildForCheck();

        expect(output).toEqual({
            soFile: '/project/dist/build/app.so',
            entryNames: [{ isMain: true, name: 'app' }],
        });
    });

    it('should compile fragment after building project', async () => {
        const adapter = new HostCompilerAdapter(globalConfigHandler, projectConfigHandler);
        await adapter.buildProject();
        const output = await adapter.compileFragment('1 + 1');

        expect(output.soFile).toBe('/project/dist/build/app-0.so');
    });
});
