import {Buffer} from "node:buffer";

export class ExePart {
  private readonly text: Buffer;
  private readonly literal: Buffer;
  private readonly data: Buffer;

  private readonly entryPoint: number

  constructor(text: Buffer, literal: Buffer, data: Buffer, entryPoint: number) {
    this.text = text;
    this.literal = literal;
    this.data = data;
    this.entryPoint = entryPoint
  }

  public toString() {
    let buffers: Buffer[] = [];

    let textSize = this.text.length;
    let textSurplus = (textSize % 4) ? 4 - (textSize % 4) : 0; // TODO: 要修正。4 Byte align。

    // text size
    const textSizeBuf = Buffer.allocUnsafe(4);
    textSizeBuf.writeUIntLE(textSize + textSurplus, 0, 4);
    buffers.push(textSizeBuf);

    // literal size
    const literalSizeBuf = Buffer.allocUnsafe(4);
    literalSizeBuf.writeUIntLE(this.literal.length, 0, 4);
    buffers.push(literalSizeBuf);

    // data size
    const dataSizeBuf = Buffer.allocUnsafe(4);
    dataSizeBuf.writeUIntLE(this.data.length, 0, 4);
    buffers.push(dataSizeBuf);

    const entryPointBuf = Buffer.allocUnsafe(4);
    entryPointBuf.writeUIntLE(this.entryPoint, 0, 4);
    buffers.push(entryPointBuf);

    buffers.push(this.text);
    buffers.push(Buffer.alloc(textSurplus));
    buffers.push(this.literal);
    buffers.push(this.data);

    return Buffer.concat(buffers).toString("hex");
  }
}
