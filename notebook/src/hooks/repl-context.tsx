import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import {useState, useEffect, useRef, createContext, ReactNode} from 'react';
import * as network from "../services/network"
import { CompileError } from '../utils/error';
import { CellStateT, CellT, MemInfo, ReplStateT } from '../utils/type';
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
    iflash: MemoryT,

    updateUseJIT: (useJIT: boolean) => void,
    setLatestCellCode: (code: string) => void,
    resetStart: () => Promise<void>,
    executeLatestCell: () => Promise<void>,
    install: () => Promise<void>
}

export const ReplContext = createContext<ReplContextT>({
    // These are used if there is no provider.
    state: 'initial',
    latestCell: {id:0, code:'', state: CellStateT.UserWriting, time:undefined},
    postExecutionCells: [],
    output: [],
    runtimeError: [],
    useJIT: true,
    iram: MemoryDummry,
    dram: MemoryDummry,
    iflash: MemoryDummry,

    updateUseJIT: (useJIT: boolean) => {},
    setLatestCellCode: (code: string) => {},
    resetStart: async () => {},
    executeLatestCell: async () => {},
    install: async () => {}
});

export default function ReplProvider({children}: {children: ReactNode}) {
    const [replState, setReplState] = useState<ReplStateT>('initial')
    const [useJIT, setUseJIT] = useState(true)
    const [latestCell, setLatestCell] = useState<CellT>({id: 0, code:'', state: CellStateT.UserWriting, time:undefined})
    const [postExecutionCells, setPostExecutionCells] = useState<CellT[]>([])
    const [output, setOutput] = useState<string[]>([])
    const [runtimeError, setRuntimeError] = useState<string[]>([])
    const iram = useMemory('IRAM')
    const dram = useMemory('DRAM')
    const iflash = useMemory('Flash')
    const dflash = useMemory('DFlash')
    
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
            setLatestCell({id: 0, code:'', state: CellStateT.UserWriting, time:undefined})
            setReplState("activated")
            iram.actions.reset(meminfo.iram.address, meminfo.iram.size)
            dram.actions.reset(meminfo.dram.address, meminfo.dram.size)
            iflash.actions.reset(meminfo.iflash.address, meminfo.iflash.size)
            dflash.actions.reset(meminfo.dflash.address, meminfo.dflash.size)
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
            bytecodeBuilder.jump(entryPoint.id, entryPoint.address);
        }
        const bluetoothTime = await bluetooth.current.sendBuffers(bytecodeBuilder.generate())
        return bluetoothTime
    }

    const setMemoryUpdates = (compileResult: network.CompileResult) => {
        for (const block of compileResult.result.blocks) {
            if (block.type === 'iram')
                iram.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
             else if (block.type === 'dram')
                dram.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
            else if (block.type === 'iflash')
                iflash.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
        }
    }

    const executeLatestCell = async () => {
        setLatestCell({...latestCell, state: CellStateT.Compiling, time:undefined})
        try {
            const compileResult = useJIT ? await network.compileWithProfiling(latestCell.id, latestCell.code) : await network.compile(latestCell.id, latestCell.code)
            const compileTime = compileResult.compileTime
            setLatestCell({...latestCell, state: CellStateT.Sending, time: {compile: compileTime}})
            const bluetoothTime = await sendCompileResult(compileResult)
            setMemoryUpdates(compileResult)
            setLatestCell({...latestCell, state: CellStateT.Executing, time: {compile: compileTime, send: bluetoothTime}})
        } catch (error: any) {
            if (error instanceof CompileError) {
                const errorStrings = error.messages.map(e => e.message)
                setLatestCell({...latestCell, state: CellStateT.UserWriting, compileError: errorStrings, time:undefined})
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

    const onExecutionComplete = (id: number, exectime: number) => {
        if (id === -1) 
            return;    

        const updateCells = () => {
            console.log('update cells is called')
            const current = latestCellRef.current;
            const latestCellTime = {compile: current.time?.compile, send: current.time?.send, execute: exectime};
            setPostExecutionCells((cells) => [...cells, {...current, state: CellStateT.Done, time: latestCellTime}]);
            setLatestCell((cell) => ({state: CellStateT.UserWriting, id: cell.id + 1, code: '', time: undefined}));
        }

        console.log('complete execution', latestCellRef.current);
        if (latestCellRef.current.state === CellStateT.Executing) {
            updateCells();
        } else {
            // Sometimes execution overtake screen drawing.
            setTimeout(() => {
                console.log('complete execution', latestCellRef.current);
                if (latestCellRef.current.state !== CellStateT.Executing) {
                    window.alert(`Something wrong happend.`)
                } else {
                    updateCells();
                }
            }, 500);
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

    const install = async () => {
        setReplState('installing');
        let src = "";
        postExecutionCells.forEach(cell => src += `${cell.code}\n`);
        try {
            const compileResult = await network.compile(0, src);
            const builderForDflash = new BytecodeBufferBuilder(dflash.state.size);
            const builder = new BytecodeBufferBuilder(MAX_MTU);
            compileResult.result.blocks.forEach(block => {
                if (block.type === 'iflash')
                    builder.load(block.address, Buffer.from(block.data, "hex"))
                if (block.type === 'dram')
                    builderForDflash.load(block.address, Buffer.from(block.data, "hex"))
            });
            compileResult.result.entryPoints.forEach(entry => builderForDflash.jump(entry.id, entry.address));
            const dflashBuffer = Buffer.concat(builderForDflash.generate());
            const dflashHeader = Buffer.allocUnsafe(5);
            dflashHeader.writeUIntLE(1, 0, 1); // flash is written or not.
            dflashHeader.writeUIntLE(dflashBuffer.length, 1, 4); 
            builder.load(dflash.state.address, dflashHeader);
            builder.load(dflash.state.address + 5, dflashBuffer);
            await bluetooth.current.sendBuffers(builder.generate());
            setReplState('successfully installed');
        } catch(e: any) {
            console.log(e.message);
            setReplState('failed to install');
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
                console.log("exectime", parseResult.id, parseResult.exectime);
                onExecutionComplete(parseResult.id, parseResult.exectime)
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
            iram,
            dram,
            iflash,

            updateUseJIT: setUseJIT,
            setLatestCellCode,
            resetStart,
            executeLatestCell,
            install
        }}>
        {children}
        </ReplContext.Provider>
    )
}
