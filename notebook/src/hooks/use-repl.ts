import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import {useState, useEffect, useRef} from 'react';
import * as network from "../services/network"
import { CompileError } from '../utils/error';
import { MemInfo } from '../utils/type';
import { BYTECODE, BytecodeGenerator, bytecodeParser } from '../utils/bytecode';
import {Buffer} from "buffer";

export type ReplState = "unIntialized" | "initializing" | "initialized";

export default function useRepl() {
    const [currentCell, setCurrentCell] = useState("");
    const [executedCells, setExecutedCells] = useState<string[]>([]);
    const [log, setLog] = useState("");
    const [compileError, setCompileError] = useState("");
    const [replState, setReplState] = useState<ReplState>("unIntialized");
    
    const bluetooth = useRef(new Bluetooth());
    const onReceiveMeminfo = useRef((meminfo: MemInfo) => {});

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
                setLog("");
                setCompileError("");
                setReplState("initialized");
            }).catch(e => {
                console.log(e);
                window.alert(`Failed to reset: ${e.message}`);
            });
        }
    }

    const execute = async () => {
        setCompileError("");
        try {
            const compileResult = await network.compile(currentCell);
            const bufferGenerator = new BytecodeGenerator(MAX_MTU);
            bufferGenerator.loadToRAM(compileResult.iram.address, Buffer.from(compileResult.iram.data, "hex"));
            bufferGenerator.loadToRAM(compileResult.dram.address, Buffer.from(compileResult.dram.data, "hex"));
            bufferGenerator.loadToFlash(compileResult.flash.address, Buffer.from(compileResult.flash.data, "hex"));
            bufferGenerator.jump(compileResult.entryPoint);
            await bluetooth.current.sendBuffers(bufferGenerator.generate());
            setCurrentCell("");
            setExecutedCells([...executedCells, currentCell]);
        } catch (error: any) {
            if (error instanceof CompileError) {
                setCompileError(error.toString());
            } else {
                console.log(error);
                window.alert(`Failed to compile: ${error.message}`);
            }
        }
    }

    const onReceiveNotification = (event: Event) => {
        // @ts-ignore
        const value = event.target.value as any;
        const parseResult = bytecodeParser(value);
        switch (parseResult.bytecode) {
            case BYTECODE.RESULT_LOG:
                setLog(currentLog => currentLog + parseResult.log);
                break;
            case BYTECODE.RESULT_MEMINFO:
                onReceiveMeminfo.current(parseResult.meminfo);
                break;
            case BYTECODE.RESULT_EXECTIME:
                console.log(parseResult.exectime);
                break;                
        }
    }


    return {
        replParams: {currentCell, executedCells, log, compileError, replState}, // states
        replActions: {setCurrentCell, reset, execute} // actions
    }
}
