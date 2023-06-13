import Elf32BufferStream from "./elf32-buffer-stream";

/**
 * Relocation Table Entry for Elf32.
 */
export class Elf32Rela {
    public rOffset:number; // (再配置可能な場合)再配置により埋め込む位置をセクションの先頭からのバイトオフセットで表す。(再配置不可能な場合)再配置により埋め込まれた位置のメモリ上での仮想アドレスを表す。
    public rInfo:number; // ELF_R_SYM(rInfo)でシンボルテーブルの中でのシンボルテーブルのエントリ番号を表す。ELF_R_TYPE(rInfo)で再配置のタイプを取得できる。
    public rAddend:number; // 参照先アドレスのベース値が格納される。

    constructor(bufferStream:Elf32BufferStream) {
        this.rOffset = bufferStream.readAddr();
        this.rInfo = bufferStream.readWord();
        this.rAddend = bufferStream.readSword();
    }
}

export class Elf32RelaTable {
    public relocations: Elf32Rela[] = [];
    public sectionHeaderId:number;

    constructor(sectionHeaderId:number) {
        this.sectionHeaderId = sectionHeaderId;
    }

    public addRela(relaBufferStream:Elf32BufferStream) {
        const rela = new Elf32Rela(relaBufferStream);
        this.relocations.push(rela);
    }
}