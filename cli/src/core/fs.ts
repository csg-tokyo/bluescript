import * as fs from 'fs';
import axios from 'axios';
import extract from 'extract-zip';


export function makeDir(path: string, recursive: boolean = true) {
    fs.mkdirSync(path, {recursive});
}

export function removeDir(path: string) {
    fs.rmSync(path, { recursive: true });
}

export function exists(path: string): boolean {
    return fs.existsSync(path);
}

export function writeFile(path: string, data: string | NodeJS.ArrayBufferView) {
    fs.writeFileSync(path, data);
}

export function readFile(path: string): string {
    return fs.readFileSync(path, 'utf-8');
}

export async function downloadAndUnzip(url: string, outDir: string) {
    const tmpZipPath = `${outDir}/tmp.zip`;
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
    });
    const zipBuffer = Buffer.from(response.data);
    writeFile(tmpZipPath, zipBuffer);
    await extract(tmpZipPath, { dir: outDir });
    removeDir(tmpZipPath);
}