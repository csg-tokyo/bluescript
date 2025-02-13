
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
    {state: CellStateT.UserWriting, id: number, code: string, compileError?: string[], time: undefined} |
    {state: CellStateT.Compiling, id: number, code: string, time: undefined} |
    {state: CellStateT.Sending, id: number, code: string, time: CellTimeT} | 
    {state: CellStateT.Executing, id: number, code: string, time: CellTimeT} | 
    {state: CellStateT.Done, id: number, code: string, time: CellTimeT} 
