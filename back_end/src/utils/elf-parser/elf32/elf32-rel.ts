import Elf32BufferStream from "./elf32-buffer-stream";

/**
 * Relocation Table Entry for Elf32.
 */
export class Elf32Rel {
    public rOffset:number;
    public rInfo:number;

    constructor(bufferStream:Elf32BufferStream) {
        this.rOffset = bufferStream.readAddr();
        this.rInfo = bufferStream.readWord();
    }
}

export class Elf32RelTable {
    public relocations: Elf32Rel[] = [];
    public sectionId:number;

    constructor(bufferStream:Elf32BufferStream, sectionId:number) {
        this.sectionId = sectionId;
        this.setRelocations(bufferStream);
    }

    private setRelocations(bufferStream:Elf32BufferStream) {
        return
    }
}