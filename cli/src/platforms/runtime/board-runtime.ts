import { CompileOutput } from "@bscript/lang";
import { ProgramOutput } from "../../core/logging/program-output";
import { CompileContext } from "../compiler/compiler-adapter";

export interface BoardRuntime<Output extends CompileOutput = CompileOutput> {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    prepare(): Promise<CompileContext>;
    load(output: Output): Promise<void>;
    execute(output: Output): Promise<void>;
    setOutput(output: ProgramOutput): void;
}
