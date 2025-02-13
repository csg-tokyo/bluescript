
export type MemInfo = {
    iram:{address:number, size:number},
    dram:{address:number, size:number},
    iflash:{address:number, size:number},
    dflash:{address:number, size:number},
}

export type ReplStateT = 'initial' | 'loading' | 'activated' | 'installing' | 'successfully installed' | 'failed to install'

export enum CellStateT {
    UserWriting,
    Compiling,
    Sending,
    Executing,
    Done
}

export type CellTimeT = {
    compile?: number, 
    send?: number, 
    execute?: number
}

export type CellT = 
    {state: CellStateT.UserWriting, compileId: -1, code: string, compileError?: string[], time: undefined} |
    {state: CellStateT.Compiling, compileId: -1, code: string, time: undefined} |
    {state: CellStateT.Sending, compileId: number, code: string, time: CellTimeT} | 
    {state: CellStateT.Executing, compileId: number, code: string, time: CellTimeT} | 
    {state: CellStateT.Done, compileId: number, code: string, time: CellTimeT} 
