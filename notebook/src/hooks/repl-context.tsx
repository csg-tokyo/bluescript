import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import {useState, useEffect, useRef, createContext, ReactNode} from 'react';
import * as network from "../services/network"
import { CompileError } from '../utils/error';
import { CellT, MemInfo, ReplStateT } from '../utils/type';
import { BYTECODE, BytecodeBufferBuilder, bytecodeParser } from '../utils/bytecode';
import {Buffer} from "buffer";
import { MemoryDummry, MemoryT, useMemory } from './use-memory';

export type ReplContextT = {
    state: ReplStateT,
    latestCell: CellT,
    postExecutionCells: CellT[],
    output: string[],
    runtimeError: string[],
    useJIT: boolean,
    useFlash: boolean,
    iram: MemoryT,
    dram: MemoryT,

    updateUseJIT: (useJIT: boolean) => void,
    updateUseFlash: (useFlash: boolean) => Promise<void>,
    setLatestCellCode: (code: string) => void,
    reset: () => Promise<void>,
    executeLatestCell: () => Promise<void>,
}

export const ReplContext = createContext<ReplContextT>({
    // These are used if there is no provider.
    state: 'initial',
    latestCell: {id:0, code:'', state: 'user-writing'},
    postExecutionCells: [],
    output: [],
    runtimeError: [],
    useJIT: true,
    useFlash: false,
    iram: MemoryDummry,
    dram: MemoryDummry,

    updateUseJIT: (useJIT: boolean) => {},
    updateUseFlash: async (useFlash: boolean) => {},
    setLatestCellCode: (code: string) => {},
    reset: async () => {},
    executeLatestCell: async () => {},
});

export default function ReplProvider({children}: {children: ReactNode}) {
    const [replState, setReplState] = useState<ReplStateT>("initial")
    const [useJIT, setUseJIT] = useState(true)
    const [useFlash, setUseFlash] = useState(false)
    const [latestCell, setLatestCell] = useState<CellT>({id: 0, code:'', state: 'user-writing'})
    const [postExecutionCells, setPostExecutionCells] = useState<CellT[]>([])
    const [output, setOutput] = useState<string[]>([])
    const [runtimeError, setRuntimeError] = useState<string[]>([])
    const iram = useMemory('IRAM')
    const dram = useMemory('DRAM')
    
    const bluetooth = useRef(new Bluetooth())
    let onExecutionComplete = useRef((executionTime: number) => {})

    useEffect(() => {
        bluetooth.current.setNotificationHandler(onReceiveNotification);
    },[])
        
    const reset = async () => {
        setReplState("loading")
        const bytecodeBuffer = new BytecodeBufferBuilder(MAX_MTU).reset().generate()
        try {
            await bluetooth.current.sendBuffers(bytecodeBuffer)
        } catch (error: any) {
            // TODO: 要修正
            console.log(error)
            window.alert(`Failed to reset: ${error.message}`)
        }
    }

    const executeLatestCell = async () => {
        let updatedLatestCell:CellT = {...latestCell, compileError: '', state: 'compiling'}
        setLatestCell(updatedLatestCell)
        try {
            const compileResult = useJIT ? await network.compileWithProfiling(updatedLatestCell.code) : await network.compile(updatedLatestCell.code)
            const iramBuffer = Buffer.from(compileResult.iram.data, "hex")
            const dramBuffer = Buffer.from(compileResult.dram.data, "hex")
            const flashBuffer = Buffer.from(compileResult.flash.data, "hex")
            const bytecodeBuffer = 
                    new BytecodeBufferBuilder(MAX_MTU)
                        .loadToRAM(compileResult.iram.address, iramBuffer)
                        .loadToRAM(compileResult.dram.address, dramBuffer)
                        .loadToFlash(compileResult.flash.address, flashBuffer)
                        .jump(compileResult.entryPoint)
                        .generate()
            updatedLatestCell = {...updatedLatestCell, state: 'sending'}
            setLatestCell(updatedLatestCell)
            iram.actions.setUsedSegment(compileResult.iram.address, iramBuffer.length)
            dram.actions.setUsedSegment(compileResult.dram.address, dramBuffer.length)
            const bluetoothTime = await bluetooth.current.sendBuffers(bytecodeBuffer)
            const compileTime = compileResult.compileTime
            updatedLatestCell = {...updatedLatestCell, state: 'executing', time: {compile: compileTime, bluetooth: bluetoothTime}}
            setLatestCell(updatedLatestCell)
            onExecutionComplete.current = (executionTime: number) => {
                if (updatedLatestCell.time !== undefined && updatedLatestCell.time?.execution === undefined) {
                    updatedLatestCell.time.execution = executionTime
                    updatedLatestCell.state = 'done'
                    const nextCellId = updatedLatestCell.id + 1
                    setPostExecutionCells((cells) =>
                        [...cells, updatedLatestCell]
                    )
                    setLatestCell({id: nextCellId, code: '', state: 'user-writing'})
                }
                
            }
        } catch (error: any) {
            if (error instanceof CompileError) {
                setLatestCell({...latestCell, state: 'user-writing', compileError: error.toString()})
            } else {
                // TODO: 要修正
                console.log(error)
                window.alert(`Failed to compile: ${error.message}`)
            }
        }
    }

    const setLatestCellCode = (code: string) => {
        setLatestCell({...latestCell, code})
    }

    const updateUseFlash = async (useFlash: boolean) => {
        setUseFlash(useFlash)
        await reset()
    }

    const onDeviceResetComplete = (meminfo: MemInfo) => {
        network.reset(meminfo, useFlash).then(() => {
            setPostExecutionCells([])
            setOutput([])
            setRuntimeError([])
            setLatestCell({id: 0, code:'', state: 'user-writing'})
            setReplState("activated")
            iram.actions.reset(meminfo.iram.address, meminfo.iram.size)
            dram.actions.reset(meminfo.dram.address, meminfo.dram.size)
        }).catch(e => {
            // TODO: 要修正
            console.log(e)
            window.alert(`Failed to reset: ${e.message}`)
        });
    }

    const jitCompile = (fid: number, paramtypes: string[]) => {
        network.jitCompile(fid, paramtypes).then((compileResult) => {
            console.log(compileResult)
            const bytecodeBuffer = 
                new BytecodeBufferBuilder(MAX_MTU)
                    .loadToRAM(compileResult.iram.address, Buffer.from(compileResult.iram.data, "hex"))
                    .loadToRAM(compileResult.dram.address, Buffer.from(compileResult.dram.data, "hex"))
                    .loadToFlash(compileResult.flash.address, Buffer.from(compileResult.flash.data, "hex"))
                    .jump(compileResult.entryPoint)
                    .generate()
            bluetooth.current.sendBuffers(bytecodeBuffer).then(() => console.log("JIT finish!"))
        })
    }

    const onReceiveNotification = (event: Event) => {
        // @ts-ignore
        const value = event.target.value as any;
        const parseResult = bytecodeParser(value);
        switch (parseResult.bytecode) {
            case BYTECODE.RESULT_LOG:
                setOutput(output => [...output, parseResult.log])
                break;
            case BYTECODE.RESULT_ERROR:
                setRuntimeError(runtimeError => [...runtimeError, parseResult.error])
                break;
            case BYTECODE.RESULT_MEMINFO:
                console.log(parseResult.meminfo)
                onDeviceResetComplete(parseResult.meminfo)
                break;
            case BYTECODE.RESULT_EXECTIME: 
                onExecutionComplete.current(parseResult.exectime)
                break;
            case BYTECODE.RESULT_PROFILE: {
                console.log("receive profile", parseResult.fid, parseResult.paramtypes);
                jitCompile(parseResult.fid, parseResult.paramtypes)
                break; 
            }
                           
        }
    }


    return (
        <ReplContext.Provider value={{
            state: replState,
            latestCell,
            postExecutionCells,
            output,
            runtimeError,
            useJIT,
            useFlash,
            iram,
            dram,

            updateUseJIT: setUseJIT,
            updateUseFlash,
            setLatestCellCode,
            reset,
            executeLatestCell,
        }}>
        {children}
        </ReplContext.Provider>
    )
}
