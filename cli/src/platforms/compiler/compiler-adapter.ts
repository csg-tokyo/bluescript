import { CompileOutput, MemoryLayout } from "@bscript/lang";
import { BoardName } from "../../config/board-utils";

export type CompileContext = {
    memoryLayout?: MemoryLayout;
};

export interface CompilerAdapter {
    readonly boardName: BoardName;
    buildForCheck(): Promise<CompileOutput>;
    buildProject(context?: CompileContext): Promise<CompileOutput>;
    compileFragment(src: string): Promise<CompileOutput>;
}
