import { Buffer } from 'node:buffer';
import Elf32BufferStream from "./elf32-buffer-stream";

const EI_NIDENT: number = 16

/**
 * ELF Header for Elf32.
 */
export default class Elf32Ehdr {
    static SIZE:number = 54;

    public eIdent: string;
    public eType: number;
    public eMachine: number;
    public eVersion: number;
    public eEntry: number;
    public ePhoff: number; // Position for program header. Byte offset from file head.
    public eShoff: number;　// Position for section header. Byte offset from file head.
    public eFlags: number;
    public eEhsize: number;
    public ePhentsize: number; // Size of program header.
    public ePhnum: number; // Number of program header.
    public eShentsize: number; // Size of section header.
    public eShnum: number; // Number of section header.
    public eShstrndx: number; // Section id for section names.

    constructor(buffer: Buffer, offset = 0) {
        const bufferStream = new Elf32BufferStream(buffer, offset);

        this.eIdent = bufferStream.readString(EI_NIDENT);
        this.eType = bufferStream.readHalf();
        this.eMachine = bufferStream.readHalf();
        this.eVersion = bufferStream.readWord();
        this.eEntry = bufferStream.readAddr();
        this.ePhoff = bufferStream.readOff();
        this.eShoff = bufferStream.readOff();
        this.eFlags = bufferStream.readWord();
        this.eEhsize = bufferStream.readHalf();
        this.ePhentsize = bufferStream.readHalf();
        this.ePhnum = bufferStream.readHalf();
        this.eShentsize = bufferStream.readHalf();
        this.eShnum = bufferStream.readHalf();
        this.eShstrndx = bufferStream.readHalf();
    }
}