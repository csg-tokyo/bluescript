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
    iram: MemoryT,
    dram: MemoryT,
    flash: MemoryT

    updateUseJIT: (useJIT: boolean) => void,
    updateUseFlash: (useFlash: boolean) => void,
    setLatestCellCode: (code: string) => void,
    resetStart: () => Promise<void>,
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
    iram: MemoryDummry,
    dram: MemoryDummry,
    flash: MemoryDummry,

    updateUseJIT: (useJIT: boolean) => {},
    updateUseFlash: (useFlash: boolean) => {},
    setLatestCellCode: (code: string) => {},
    resetStart: async () => {},
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
    const flash = useMemory('Flash')
    
    const bluetooth = useRef(new Bluetooth())

    // To use these variables in callbacks
    const latestCellRef = useRef(latestCell)
    latestCellRef.current = latestCell
    
    useEffect(() => {
        bluetooth.current.setNotificationHandler(onReceiveNotification);
    },[])

    const resetStart = async () => {
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

    const onResetComplete = (meminfo: MemInfo) => {
        network.reset(meminfo).then(() => {
            setPostExecutionCells([])
            setOutput([])
            setRuntimeError([])
            setLatestCell({id: 0, code:'', state: 'user-writing'})
            setReplState("activated")
            iram.actions.reset(meminfo.iram.address, meminfo.iram.size)
            dram.actions.reset(meminfo.dram.address, meminfo.dram.size)
            flash.actions.reset(meminfo.flash.address, meminfo.flash.size)
        }).catch(e => {
            // TODO: 要修正
            console.log(e)
            window.alert(`Failed to reset: ${e.message}`)
        });
    }

    const sendCompileResult = async (compileResult: network.CompileResult) => {
        const bytecodeBuilder = new BytecodeBufferBuilder(MAX_MTU)
        for (const block of compileResult.result.blocks) {
            bytecodeBuilder.load(block.address, Buffer.from(block.data, "hex"));
        }
        for (const entryPoint of compileResult.result.entryPoints) {
            bytecodeBuilder.jump(entryPoint);
        }
        const bluetoothTime = await bluetooth.current.sendBuffers(bytecodeBuilder.generate())
        return bluetoothTime
    }

    const setMemoryUpdates = (compileResult: network.CompileResult) => {
        for (const block of compileResult.result.blocks) {
            if (block.address >= iram.state.address && block.address < iram.state.address + iram.state.size)
                iram.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
             else if (block.address >= dram.state.address && block.address < dram.state.address + dram.state.size)
                dram.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
            else if (block.address >= flash.state.address && block.address < flash.state.address + flash.state.size)
                flash.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
        }
    }

    const executeLatestCell = async () => {
        setLatestCell({...latestCell, compileError: '', state: 'compiling'})
        try {
            const compileResult = useJIT ? await network.compileWithProfiling(latestCell.code) : await network.compile(latestCell.code, useFlash)
            setLatestCell({...latestCell, compileError: '', state: 'sending'})
            const bluetoothTime = await sendCompileResult(compileResult)
            const compileTime = compileResult.compileTime
            setMemoryUpdates(compileResult)
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

    const setLatestCellCode = (code: string) => {
        setLatestCell({...latestCell, code})
    }

    const onExecutionComplete = (executionTime: number) => {
        if (latestCellRef.current.time !== undefined && latestCellRef.current.time?.execution === undefined) {
            latestCellRef.current.time.execution = executionTime
            latestCellRef.current.state = 'done'
            const nextCellId = latestCellRef.current.id + 1
            const current = latestCellRef.current
            setPostExecutionCells((cells) => [...cells, current])
            setLatestCell({id: nextCellId, code: '', state: 'user-writing'})
        }
    }

    const jitCompile = async (fid: number, paramtypes: string[]) => {
        try {
            const compileResult = await network.jitCompile(fid, paramtypes)
            await sendCompileResult(compileResult)
            setMemoryUpdates(compileResult)
            console.log('JIT finish')
        } catch (error: any) {
            // TODO: 要修正
            console.log(error)
            window.alert(`Failed to compile: ${error.message}`)
        }
    }

    const onReceiveNotification = async (event: Event) => {
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
                onResetComplete(parseResult.meminfo)
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

    const updateUseFlash = (useFlash: boolean) => {
        if (useFlash)
            setUseJIT(false)
        setUseFlash(useFlash)
    }

    const updateUseJIT = (useJIT: boolean) => {
        if (useJIT)
            setUseFlash(false)
        setUseJIT(useJIT)
    }

    return (
        <ReplContext.Provider value={{
            state: replState,
            latestCell,
            postExecutionCells,
            output,
            runtimeError,
            useJIT,
            iram,
            dram,
            flash,

            updateUseJIT,
            updateUseFlash,
            setLatestCellCode,
            resetStart,
            executeLatestCell,
        }}>
        {children}
        </ReplContext.Provider>
    )
}
