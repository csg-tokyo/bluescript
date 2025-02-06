
export type MemInfo = {
    iram:{address:number, size:number},
    dram:{address:number, size:number},
    iflash:{address:number, size:number},
    dflash:{address:number, size:number},
}

export type ReplStateT = 'initial' | 'loading' | 'activated' | 'installing' | 'successfully installed' | 'failed to install'

export type CellStateT = 'user-writing' | 'compiling' | 'sending' | 'executing' | 'done'

export type CellTimeT = {
    compile?: number, 
    bluetooth?: number, 
    execution?: number
}

export type CellT = {
    id: number,
    code: string,
    state: CellStateT,
    compileError?: string,
    time?: CellTimeT
}

