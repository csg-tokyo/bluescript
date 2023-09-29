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

    // Add section length
    buffers.push(Buffer.from(this.text.length.toString(16).padStart(4, "0"), "hex"));
    buffers.push(Buffer.from(this.literal.length.toString(16).padStart(4, "0"), "hex"));
    buffers.push(Buffer.from(this.data.length.toString(16).padStart(4, "0"), "hex"));
    // Add entry point address.
    buffers.push(Buffer.from(this.entryPoint.toString(16).padStart(8, "0"), "hex"));
    // Add section values.
    buffers.push(this.text);
    buffers.push(this.literal);
    buffers.push(this.data);

    return Buffer.concat(buffers).toString("hex");
  }
}
