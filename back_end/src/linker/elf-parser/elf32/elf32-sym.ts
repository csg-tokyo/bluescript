import Elf32BufferStream from "./elf32-buffer-stream";

/**
 * Symbol Table Entry for Elf32.
 */
export default class Elf32Sym {
    public stName:number; // .strtabセクションの先頭からのバイトオフセットを表す。
    public stValue:number; // (再配置可能な場合)配置されている位置をセクションの先頭からのオフセットで表す。(再配置不可能な場合)シンボルがメモリ上に配置される際の仮想アドレスを指す。
    public stSize:number; // シンボルの実態のサイズをバイト単位で表したもの。
    public stInfo:number; // ELF_ST_BIND(stInfo)でファイルローカルかグローバルシンボルか知ることができる(STB_XX)。ELF_ST_TYPE(stInfo)でシンボルタイプが取得できる(STT_XX)。
    public stOther:number;
    public stShndx:number; // シンボルが関連するセクションの番号。


    constructor(bufferStream:Elf32BufferStream) {
        this.stName = bufferStream.readWord();
        this.stValue = bufferStream.readAddr();
        this.stSize = bufferStream.readWord();
        this.stInfo = bufferStream.readChar();
        this.stOther = bufferStream.readChar();
        this.stShndx = bufferStream.readHalf();
    }
}