import { CompileOutput } from "@bscript/lang";
import { ProgramOutput } from "../../core/logger/program-output";
import { CompileContext } from "../compiler/compiler-adapter";

export interface BoardRuntime<Output extends CompileOutput = CompileOutput> {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    prepare(): Promise<CompileContext>;
    load(output: Output, onPacketSent?: (percent: number) => void): Promise<number>;
    execute(output: Output): Promise<number>;
    setOutput(output: ProgramOutput): void;
}
