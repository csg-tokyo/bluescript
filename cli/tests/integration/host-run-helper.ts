import * as path from 'path';
import * as fs from '../../src/core/fs';
import { ProjectConfigHandler } from '../../src/config/project-config';
import { PROJECT_DEFAULT_PATHS } from '../../src/config/project-config';

export type HostPackageSpec = {
    name: string;
    sources: Record<string, string>;
};

function writeSources(root: string, sources: Record<string, string>) {
    for (const [relativePath, code] of Object.entries(sources)) {
        const filePath = path.join(root, relativePath);
        fs.makeDir(path.dirname(filePath));
        fs.writeFile(filePath, code);
    }
}

function createHostPackage(
    projectRoot: string,
    packageName: string,
    sources: Record<string, string>,
    runtimeDir: string,
) {
    const packageRoot = path.join(projectRoot, PROJECT_DEFAULT_PATHS.PACKAGES_DIR, packageName);
    writeSources(packageRoot, sources);

    const handler = ProjectConfigHandler.createTemplate(packageName, 'host', packageRoot);
    handler.update({
        srcDir: './src',
        entryFile: './src/index.bs',
        runtimeDir,
    });
    handler.save(packageRoot);
}

export function createHostProject(
    root: string,
    sources: Record<string, string>,
    runtimeDir: string,
    projectName = 'test-run',
    packages: HostPackageSpec[] = [],
) {
    for (const pkg of packages) {
        createHostPackage(root, pkg.name, pkg.sources, runtimeDir);
    }

    writeSources(root, sources);

    const handler = ProjectConfigHandler.createTemplate(projectName, 'host', root);
    handler.update({
        srcDir: './src',
        entryFile: './src/index.bs',
        runtimeDir,
    });
    for (const pkg of packages) {
        handler.addDependency({
            name: pkg.name,
            url: `https://example.com/${pkg.name}.git`,
        });
    }
    handler.save(root);
}

export function removeDirIfExists(dir: string) {
    if (fs.exists(dir)) {
        fs.removeDir(dir);
    }
}

export function mockProcessExit() {
    return jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
}

export function captureStdout() {
    const chunks: string[] = [];
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
    });

    return {
        text: () => chunks.join(''),
        restore: () => spy.mockRestore(),
    };
}

export function captureOutput() {
    const stdout = captureStdout();
    const consoleLogs: string[] = [];
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        consoleLogs.push(args.map(String).join(' '));
    });

    return {
        text: () => stdout.text() + consoleLogs.join('\n'),
        restore: () => {
            stdout.restore();
            consoleSpy.mockRestore();
        },
    };
}

export async function waitFor(
    predicate: () => boolean,
    timeoutMs = 10000,
    intervalMs = 50,
): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('waitFor timed out');
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}

export async function waitForStdoutContains(
    output: { text: () => string },
    text: string,
    timeoutMs = 10000,
): Promise<void> {
    await waitFor(() => output.text().includes(text), timeoutMs);
}

export const HOST_INTEGRATION_RUNTIME_DIR =
    path.resolve(__dirname, '../../../microcontroller');
export const HOST_INTEGRATION_BUILD_DIR =
    path.join(HOST_INTEGRATION_RUNTIME_DIR, 'ports/host/build');
