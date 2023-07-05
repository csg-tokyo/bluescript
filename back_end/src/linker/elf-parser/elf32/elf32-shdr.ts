import Elf32BufferStream from "./elf32-buffer-stream";

/**
 * Section Header for Elf32.
 * https://refspecs.linuxbase.org/elf/gabi4+/ch4.sheader.html
 */
export default class Elf32Shdr {

    public shName:number; // セクション名の格納位置。.shstrtabセクションの先頭からのバイトオフセットで表される。
    public shType:number; // セクションのタイプ。具体的な値はSHT_xxxを参照。
    public shFlags:number; //
    public shAddr:number; // セクションがメモリにロードされる時のロード先仮想アドレス。
    public shOffset:number; // ELF形式中でのセクションの位置。ELF形式の先頭からのバイトオフセット。
    public shSize:number; // セクションのバイトサイズ。
    public shLink:number;
    public shInfo:number;
    public shAddralign:number;
    public shEntsize:number; // セクションが固定サイズの配列状になっているならば、各要素のサイズを表す。

    constructor(bufferStream:Elf32BufferStream) {
         this.shName = bufferStream.readWord();
         this.shType = bufferStream.readWord();
         this.shFlags = bufferStream.readWord();
         this.shAddr = bufferStream.readAddr();
         this.shOffset = bufferStream.readOff();
         this.shSize = bufferStream.readWord();
         this.shLink = bufferStream.readWord();
         this.shInfo = bufferStream.readWord();
         this.shAddralign = bufferStream.readWord();
         this.shEntsize = bufferStream.readWord();
    }
}