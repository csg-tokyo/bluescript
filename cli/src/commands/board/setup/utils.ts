import { exec } from '../../../core/shell';


export async function isPackageInstalledOnUnix(name: string) {
    try {
        await exec(`which ${name}`, { silent: true });
        return true;
    } catch (error) {
        return false;
    }
}

export async function isPackageInstalledOnWindows(name: string) {
    try {
        await exec(`where ${name}`, { silent: true });
        return true;
    } catch (error) {
        return false;
    }
}

export async function isPythonVersionGreaterThan3() {
    try {
        const result = await exec(
            `python -c "import sys; print(sys.version_info.major)"`,
            { silent: true },
        );
        return result.trim() === '3';
    } catch {
        return false;
    }
}