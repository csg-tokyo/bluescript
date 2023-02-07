import Elf32BufferStream from "./elf32-buffer-stream";
import ELF_PARSER_CONSTANTS from "../static/elf-parser-constants";

/**
 * ELF Header for Elf32.
 */
export default class Elf32Ehdr {
    public eIdent:string;
    public eType:number;
    public eMachine:number;
    public eVersion:number;
    public eEntry:number;
    public ePhoff:number; // プログラムヘッダのテーブルの位置。ファイルの先頭からのバイトオフセットで表す。
    public eShoff:number;　// セクションヘッダのテーブルの位置。ファイルの先頭からのバイトオフセットで表す。
    public eFlags:number;
    public eEhsize:number;
    public ePhentsize:number; // プログラムヘッダのサイズ。
    public ePhnum:number; // プログラムヘッダの個数。
    public eShentsize:number; // セクションヘッダのサイズ。
    public eShnum:number; // セクションヘッダの個数。
    public eShstrndx:number; // セクション名格納用のセクション番号を表す。

    static SIZE:number = 54;

    constructor(bufferStream:Elf32BufferStream) {
        this.eIdent = bufferStream.readString(ELF_PARSER_CONSTANTS.EI_NIDENT);
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