import { Package, Project } from '../project';

export type MemoryLayout = {
    iram:{address:number, size:number},
    dram:{address:number, size:number},
    iflash:{address:number, size:number},
    dflash:{address:number, size:number},
}

type MemoryRegion = {name: string, address: number, size: number, used: number}

export class ShadowMemory {
    public iram: MemoryRegion;
    public dram: MemoryRegion;
    public iflash: MemoryRegion;
    public dflash: MemoryRegion;

    constructor(memoryLayout: MemoryLayout) {
        this.iram = {name: '.iram', ...memoryLayout.iram, used: 0};
        this.dram = {name: '.dram', ...memoryLayout.dram, used: 0};
        this.iflash = {name: '.iflash', ...memoryLayout.iflash, used: 0};
        this.dflash = {name: '.dflash', ...memoryLayout.dflash, used: 0};
    }

    addUsage(iramSize?: number, dramSize?: number, iflashSize?: number, dflashSize?: number) {
        this.iram.used += (iramSize ?? 0);
        this.dram.used += (dramSize ?? 0);
        this.iflash.used += (iflashSize ?? 0);
        this.dflash.used += (dflashSize ?? 0);
    }
}

export type ExecutableBinary = {
    iram?: {address: number, data: Buffer},
    dram?: {address: number, data: Buffer},
    iflash?: {address: number, data: Buffer},
    dflash?: {address: number, data: Buffer},
    entryPoints: {isMain: boolean, address: number}[]
}

export interface BoardToolchain<P extends Package = Package> {
    memory: ShadowMemory;

	get cProlog(): string;
    get builtinModulePath(): string;
	compileC(project: Project<P>, pkg: P): Promise<void>;
	link(project: Project<P>, entryPoints: string[]): Promise<string>;
	extractBinary(elfPath: string, entryPoints: string[]): ExecutableBinary;
}