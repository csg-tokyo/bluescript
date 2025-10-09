import {useState, createContext, ReactNode} from 'react';


export type ReplStateT = 'initial' | 'network-connecting' | 'network-disconnected' | 'executing-main' | 'activated';

export type EditingCellT = {state: 'editing', id: number, code: string, compileError: string[]};
export type LoadingCellT = {state: 'compiling' | 'sending' | 'executing', id: number, code: string};
export type ExecutedCellT = {state: 'executed', id: number, code: string, time: {compilation: number, sending: number, execution: number}};
export type CellT = EditingCellT | LoadingCellT | ExecutedCellT;

export type LogT = {message: string, type: 'output' | 'error'};

export type ReplContextT = {
    state: ReplStateT,
    latestCell: EditingCellT | LoadingCellT,
    executedCells: ExecutedCellT[],
    logs: LogT[]

    setCode: (code: string) => void,
    execute: () => Promise<void>,
}

export const ReplContext = createContext<ReplContextT | undefined>(undefined);

export default function ReplProvider({children}: {children: ReactNode}) {
    const [replState, setReplState] = useState<ReplStateT>('activated');
    const [latestCell, setLatestCell] = useState<EditingCellT | LoadingCellT>({id:-1, code:'', state: 'editing', compileError:[]});
    const [executedCells, setExecutedCells] = useState<ExecutedCellT[]>([]);
    const [logs, setLogs] = useState<LogT[]>([]);

    const setCode = (code: string) => {
        setLatestCell({...latestCell, code});
    }

    const execute = async () => {
        console.log("execute");
    }

    return (
        <ReplContext.Provider value={{
            state: replState,
            latestCell,
            executedCells,
            logs,
            setCode,
            execute,
        }}>
        {children}
        </ReplContext.Provider>
    )
}
