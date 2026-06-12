import { CompileOutput } from "@bscript/lang";
import { ProgramOutput } from "../../core/logging/program-output";
import { CompileContext } from "../compiler/compiler-adapter";

export interface BoardRuntime {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    prepare(): Promise<CompileContext>;
    load(output: CompileOutput): Promise<void>;
    execute(output: CompileOutput): Promise<void>;
    setOutput(output: ProgramOutput): void;
}
