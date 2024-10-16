import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import {useState, useEffect, useRef} from 'react';
import * as network from "../services/network"
import { CompileError } from '../utils/error';
import { MemInfo } from '../utils/type';
import { BYTECODE, BytecodeGenerator, bytecodeParser } from '../utils/bytecode';
import {Buffer} from "buffer";
import { Log } from '../view/components/log-area';

export type ReplState = "unInitialized" | "initializing" | "initialized";

export type Cell = {
    code: string,
    compileTime?:number,
    bluetoothTime?:number,
    executionTime?:number
}

export default function useRepl() {
    const [currentCell, setCurrentCell] = useState<Cell>({code:""});
    const [executedCells, setExecutedCells] = useState<Cell[]>([]);
    const [log, setLog] = useState<Log[]>([]);
    const [compileError, setCompileError] = useState("");
    const [replState, setReplState] = useState<ReplState>("unInitialized");
    
    const bluetooth = useRef(new Bluetooth());
    const onReceiveMeminfo = useRef((meminfo: MemInfo) => {});
    const onReceiveExectime = useRef((exectime: number) => {});

    useEffect(() => {
        bluetooth.current.setNotificationHandler(onReceiveNotification);
    },[]);
        
    const reset = async (useFlash:boolean=false) => {
        setReplState("initializing");
        const bufferGenerator = new BytecodeGenerator(MAX_MTU);
        bufferGenerator.reset();
        try {
            await bluetooth.current.sendBuffers(bufferGenerator.generate());
        } catch (error: any) {
            console.log(error);
            window.alert(`Failed to reset: ${error.message}`);
        }
        onReceiveMeminfo.current = (meminfo: MemInfo) => {
            network.reset(meminfo, useFlash).then(() => {
                setExecutedCells([]);
                setLog([]);
                setCompileError("");
                setCurrentCell({code:""})
                setReplState("initialized");
            }).catch(e => {
                console.log(e);
                window.alert(`Failed to reset: ${e.message}`);
            });
        }
    }

    const execute = async () => {
        setCompileError("");
        let updatedCurrentCell:Cell;
        try {
            const compileResult = await network.compile(currentCell.code);
            const bufferGenerator = new BytecodeGenerator(MAX_MTU);
            bufferGenerator.loadToRAM(compileResult.iram.address, Buffer.from(compileResult.iram.data, "hex"));
            bufferGenerator.loadToRAM(compileResult.dram.address, Buffer.from(compileResult.dram.data, "hex"));
            bufferGenerator.loadToFlash(compileResult.flash.address, Buffer.from(compileResult.flash.data, "hex"));
            bufferGenerator.jump(compileResult.entryPoint);
            const bluetoothTime = await bluetooth.current.sendBuffers(bufferGenerator.generate());
            updatedCurrentCell = {...currentCell, bluetoothTime, compileTime:compileResult.compileTime}
            setCurrentCell(updatedCurrentCell);
        } catch (error: any) {
            if (error instanceof CompileError) {
                setCompileError(error.toString());
            } else {
                console.log(error);
                window.alert(`Failed to compile: ${error.message}`);
            }
        }
        onReceiveExectime.current = (exectime:number) => {
            setExecutedCells([...executedCells, {...updatedCurrentCell, executionTime:exectime}]);
            setCurrentCell({code:""});
        }
    }

    const onReceiveNotification = (event: Event) => {
        // @ts-ignore
        const value = event.target.value as any;
        const parseResult = bytecodeParser(value);
        switch (parseResult.bytecode) {
            case BYTECODE.RESULT_LOG:
                setLog(currentLog => [...currentLog, {type:"log", str:parseResult.log}])
                break;
            case BYTECODE.RESULT_ERROR:
                setLog(currentLog => [...currentLog, {type:"error", str:parseResult.log}])
                break;
            case BYTECODE.RESULT_MEMINFO:
                onReceiveMeminfo.current(parseResult.meminfo);
                break;
            case BYTECODE.RESULT_EXECTIME:
                onReceiveExectime.current(parseResult.exectime);
                break;
            case BYTECODE.RESULT_PROFILE:
                console.log("receive profile", parseResult.profile);
                break;            
        }
    }


    return {
        replParams: {currentCell, executedCells, log, compileError, replState}, // states
        replActions: {setCurrentCell, reset, execute} // actions
    }
}
