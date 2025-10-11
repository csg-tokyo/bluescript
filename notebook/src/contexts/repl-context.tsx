import {useState, createContext, ReactNode, useRef, useEffect} from 'react';
import { ReplService, WebSocketClient } from '../lib/websocket-client';


export type ReplStateT = 'initial' | 'network-connecting' | 'network-disconnected' | 'activated';

export type EditingCellT = {state: 'editing', code: string, compileError?: string};
export type LoadingCellT = {state: 'compiling' | 'sending' | 'executing', code: string};
export type ExecutedCellT = {state: 'executed', id: number, code: string, time: {compilation: number, sending: number, execution: number}};


export type LogT = {message: string, type: 'output' | 'error'};

export type ReplContextT = {
    state: ReplStateT,
    latestCell: EditingCellT | LoadingCellT,
    executedCells: ExecutedCellT[],
    logs: LogT[]
    setCode: (code: string) => void,
    executeLatestCell: () => Promise<void>,
}

export const ReplContext = createContext<ReplContextT | undefined>(undefined);

export default function ReplProvider({children}: {children: ReactNode}) {
    const [replState, setReplState] = useState<ReplStateT>('network-connecting');
    const [latestCell, setLatestCell] = useState<EditingCellT | LoadingCellT>({state: 'editing', code:''});
    const [executedCells, setExecutedCells] = useState<ExecutedCellT[]>([]);
    const [logs, setLogs] = useState<LogT[]>([]);

    const wsc = useRef<WebSocketClient|null>(null);
    const replService = useRef<ReplService|null>(null);

    useEffect(() => {
        const url = 'ws://localhost:8080';
        wsc.current = new WebSocketClient();
        wsc.current.on('connected', () => {
            setReplState('activated');
            replService.current = wsc.current?.getService('repl') ?? null;
            replService.current?.on('log', (message) => setLogs((logs) => [...logs, {message, type: 'output'}]));
            replService.current?.on('error', (message) => setLogs((logs) => [...logs, {message, type: 'error'}]));
        });
        wsc.current.on('disconnected', () => setReplState('network-disconnected'));

        wsc.current.connect(url);
        
        return () => {
            wsc.current?.disconnect();
            wsc.current?.off('connected');
            wsc.current?.off('disconnected');
            replService.current?.off('log');
            replService.current?.off('error');
        }
    }, []);

    const setCode = (code: string) => {
        setLatestCell({...latestCell, code});
    }

    const executeLatestCell = async () => {
        const code = latestCell.code;
        replService.current?.execute(code);
        const [compilationTime, compileError] = await new Promise<[number, string|undefined]>((resolve)=> {
            replService.current?.on('finishCompilation', (time, error) => {
                resolve([time, error]);
                replService.current?.off('finishCompilation');
            });
        });
        if (compileError) {
            setLatestCell(cell => ({...cell, compileError}));
            return;
        }

        const sendingTime = await new Promise<number>((resolve)=> {
            replService.current?.on('finishSending', (time) => {
                resolve(time);
                replService.current?.off('finishSending');
            });
        });
        const executionTime = await new Promise<number>((resolve)=> {
            replService.current?.on('finishExecution', (time) => {
                resolve(time);
                replService.current?.off('finishExecution');
            });
        });

        setLatestCell({code:'', state: 'editing'});
        setExecutedCells((cells) => [...cells, {
            state: 'executed', 
            code: code, 
            id:cells.length, 
            time: {compilation: compilationTime, sending: sendingTime, execution: executionTime}}
        ]);
    }

    return (
        <ReplContext.Provider value={{
            state: replState,
            latestCell,
            executedCells,
            logs,
            setCode,
            executeLatestCell,
        }}>
        {children}
        </ReplContext.Provider>
    )
}
