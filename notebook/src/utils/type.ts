
export type MemInfo = {
    iram:{address:number, size:number},
    dram:{address:number, size:number},
    flash:{address:number, size:number},
}

export type CellStateT = 'user-writing' | 'compiling' | 'sending' | 'executing' | 'done'

export type CellTimeT = {
    compile?: number, 
    bluetooth?: number, 
    execution?: number
}

export type CellT = {
    code: string,
    state: CellStateT,
    compileError: string,
    time: CellTimeT
}

