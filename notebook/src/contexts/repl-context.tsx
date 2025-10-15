import {useState, createContext, ReactNode, useRef, useEffect} from 'react';
import { ReplService, WebSocketClient } from '../lib/websocket-client';


export type ReplStateT = 'initial' | 'network-connecting' | 'network-disconnected' | 'executing-main' | 'activated';

export type MainStateT = {state: 'initial'}
                     | {state: 'compiling'} | {state: 'failed-to-compile', error: string}
                     | {state: 'loading'} | {state: 'executing'} | {state: 'executed'} 

export type EditingCellT = {state: 'editing', code: string, compileError?: string};
export type ExecutingCellT = {state: 'compiling' | 'loading' | 'executing', code: string};
export type ExecutedCellT = {state: 'executed', id: number, code: string, time: {compilation: number, loading: number, execution: number}};


export type LogT = {message: string, type: 'output' | 'error'};

export type ReplContextT = {
    state: ReplStateT,
    mainState: MainStateT,
    latestCell: EditingCellT | ExecutingCellT,
    executedCells: ExecutedCellT[],
    logs: LogT[],
    executeMain: () => Promise<void>,
    setCode: (code: string) => void,
    executeLatestCell: () => Promise<void>,
}

export const ReplContext = createContext<ReplContextT | undefined>(undefined);

export default function ReplProvider({children}: {children: ReactNode}) {
    const [replState, setReplState] = useState<ReplStateT>('initial');
    const [mainState, setMainState] = useState<MainStateT>({state: 'initial'});
    const [latestCell, setLatestCell] = useState<EditingCellT | ExecutingCellT>({state: 'editing', code:''});
    const [executedCells, setExecutedCells] = useState<ExecutedCellT[]>([]);
    const [logs, setLogs] = useState<LogT[]>([]);

    const wsc = useRef<WebSocketClient|null>(null);
    const replService = useRef<ReplService|null>(null);

    useEffect(() => {
        const url = 'ws://localhost:8080';
        wsc.current = new WebSocketClient();
        wsc.current.on('connected', () => {
            setReplState('executing-main');
            replService.current = wsc.current?.getService('repl') ?? null;
            replService.current?.on('log', (message) => setLogs((logs) => [...logs, {message, type: 'output'}]));
            replService.current?.on('error', (message) => setLogs((logs) => [...logs, {message, type: 'error'}]));
        });
        wsc.current.on('disconnected', () => {
            setReplState('network-disconnected');
        });

        wsc.current.connect(url);
        
        return () => {
            wsc.current?.off('connected');
            wsc.current?.off('disconnected');
            replService.current?.off('log');
            replService.current?.off('error');
            wsc.current?.disconnect();
            wsc.current = null;
            replService.current = null;
        }
    }, []);

    const executeMain = async () => {
        setMainState({state: 'compiling'});
        await replService.current?.executeMain({
            onFailedToCompile: (error) => setMainState({state: 'failed-to-compile', error}),
            onFinishCompilation: () => setMainState({state: 'loading'}),
            onFinishLoading: () => setMainState({state: 'executing'}),
            onFinishExecution: () => {setMainState({state: 'executed'}); setReplState('activated');}
        });
    }

    const setCode = (code: string) => {
        setLatestCell({...latestCell, code});
    }

    const executeLatestCell = async () => {
        const code = latestCell.code;
        setLatestCell((cell) => ({...cell, state: 'compiling'}));
        let cTime:number, lTime:number, eTime: number;
        await replService.current?.executeCell(code, {
            onFailedToCompile: (error) => setLatestCell(cell => ({...cell, state: 'editing', compileError: error})),
            onFinishCompilation: (time) => {cTime = time; setLatestCell((cell) => ({...cell, state: 'loading'}));},
            onFinishLoading: (time) => {lTime = time; setLatestCell((cell) => ({...cell, state: 'executing'}));},
            onFinishExecution: (time) => {
                eTime = time; 
                setLatestCell({code:'', state: 'editing'});
                setExecutedCells((cells) => [...cells, {
                    state: 'executed', 
                    code: code, 
                    id:cells.length, 
                    time: {compilation: cTime, loading: lTime, execution: eTime}}
                ]);
            }
        });
    }

    return (
        <ReplContext.Provider value={{
            state: replState,
            mainState,
            latestCell,
            executedCells,
            logs,
            executeMain,
            setCode,
            executeLatestCell,
        }}>
        {children}
        </ReplContext.Provider>
    )
}
