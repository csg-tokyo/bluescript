import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import React, {useState, useEffect, useRef, createContext, ReactNode} from 'react';
import * as network from "../services/network"
import { CompileError } from '../utils/error';
import { CellT, MemInfo, ReplStateT } from '../utils/type';
import { BYTECODE, BytecodeBufferBuilder, bytecodeParser } from '../utils/bytecode';
import {Buffer} from "buffer";

export type ReplContextT = {
    state: ReplStateT,
    latestCell: CellT,
    postExecutionCells: CellT[],
    output: string[],
    runtimeError: string[],
    useJIT: boolean,
    useFlash: boolean, 

    updateUseJIT: (useJIT: boolean) => void,
    updateUseFlash: (useFlash: boolean) => Promise<void>,
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

    updateUseJIT: (useJIT: boolean) => {},
    updateUseFlash: async (useFlash: boolean) => {},
    reset: async () => {},
    executeLatestCell: async () => {},
});

export type ReplProviderProps = {
    children: ReactNode;
}

export default function ReplProvider({children}: ReplProviderProps) {
    const [replState, setReplState] = useState<ReplStateT>("initial")
    const [useJIT, setUseJIT] = useState(true)
    const [useFlash, setUseFlash] = useState(false)

    const [latestCellId, setLatestCellId] = useState(0)
    const [latestCell, setLatestCell] = useState<CellT>({id: latestCellId, code:'', state: 'user-writing'})
    const [postExecutionCells, setPostExecutionCells] = useState<CellT[]>([])
    const [output, setOutput] = useState<string[]>([])
    const [runtimeError, setRuntimeError] = useState<string[]>([])
    
    const bluetooth = useRef(new Bluetooth())

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
        setLatestCell({...latestCell, compileError: '', state: 'compiling'})
        try {
            const compileResult = useJIT ? await network.compileWithProfiling(latestCell.code) : await network.compile(latestCell.code)
            const bytecodeBuffer = 
                    new BytecodeBufferBuilder(MAX_MTU)
                        .loadToRAM(compileResult.iram.address, Buffer.from(compileResult.iram.data, "hex"))
                        .loadToRAM(compileResult.dram.address, Buffer.from(compileResult.dram.data, "hex"))
                        .loadToFlash(compileResult.flash.address, Buffer.from(compileResult.flash.data, "hex"))
                        .jump(compileResult.entryPoint)
                        .generate()
            setLatestCell({...latestCell, compileError: '', state: 'sending'})
            const bluetoothTime = await bluetooth.current.sendBuffers(bytecodeBuffer)
            const compileTime = compileResult.compileTime
            setLatestCell({...latestCell, state: 'executing', time: {compile: compileTime, bluetooth: bluetoothTime}})
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

    const updateUseFlash = async (useFlash: boolean) => {
        setUseFlash(useFlash)
        await reset()
    }

    const onDeviceResetComplete = (meminfo: MemInfo) => {
        network.reset(meminfo, useFlash).then(() => {
            setPostExecutionCells([])
            setOutput([])
            setRuntimeError([])
            setLatestCellId(0)
            setLatestCell({id: 0, code:'', state: 'user-writing'})
            setReplState("activated")
        }).catch(e => {
            // TODO: 要修正
            console.log(e)
            window.alert(`Failed to reset: ${e.message}`)
        });
    }

    const onExecutionComplete = (executionTime: number) => {
        // TODO: idで判別
        const cellId = latestCellId
        setPostExecutionCells([...postExecutionCells, {...latestCell, time: {...latestCell.time, execution: executionTime}}])
        setLatestCellId(cellId + 1)
        setLatestCell({id: latestCellId, code: '', state: 'user-writing'})
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
                setOutput([...output, parseResult.log])
                break;
            case BYTECODE.RESULT_ERROR:
                setRuntimeError([...runtimeError, parseResult.error])
                break;
            case BYTECODE.RESULT_MEMINFO:
                onDeviceResetComplete(parseResult.meminfo)
                break;
            case BYTECODE.RESULT_EXECTIME: 
                onExecutionComplete(parseResult.exectime)
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

            updateUseJIT: setUseJIT,
            updateUseFlash,
            reset,
            executeLatestCell,
        }}>
        {children}
        </ReplContext.Provider>
    )
}
