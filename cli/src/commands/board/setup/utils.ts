import { simpleExec } from '../../../core/command-exec';


export async function isPackageInstalledOnUnix(name: string) {
    try {
        await simpleExec('which', [name]);
        return true;
    } catch {
        return false;
    }
}

export async function isPackageInstalledOnWindows(name: string) {
    try {
        await simpleExec('where.exe', [name]);
        return true;
    } catch {
        return false;
    }
}

export async function isPythonVersionGreaterThan3() {
    try {
        const result = await simpleExec(
            'python',
            ['-c', 'import sys; print(sys.version_info.major)'],
        );
        return result.trim() === '3';
    } catch {
        return false;
    }
}
